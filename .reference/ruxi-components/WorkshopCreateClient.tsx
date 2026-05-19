'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { SITE_CONFIG } from '@/config/site';
import { worldsAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { getDisplayInitial, getTextLength, safeStorage, truncateText } from '@/lib/utils';
import { toast } from '@/lib/toast';

/* ── Types ─────────────────────────────────────────────── */

interface Character {
  id: string;
  name: string;
  role: 'npc' | 'antagonist' | 'companion';
  personality: string;
  background: string;
  appearance: string;
  speakingStyle: string;
  firstMeeting: string;
  isPlayable?: boolean;
  isMainCompanion?: boolean;
}

interface WorkshopForm {
  title: string;
  description: string;
  genre: string;
  playType: string;
  narrativeMode: string;
  difficulty: string;
  worldDescription: string;
  worldRules: string;
  opening: string;
}

type WorkshopDraft = {
  version: 1;
  creationType: string | null;
  step: number;
  form: WorkshopForm;
  characters: Character[];
  editingChar: Character | null;
};

const DIFFICULTIES = [
  { key: 'easy', label: '简单' },
  { key: 'normal', label: '普通' },
  { key: 'hard', label: '困难' },
];

const STEPS_WITH_TYPE = ['选择路线', '故事名片', '世界与开场', '关键角色', '保存 / 发布'];
const STEPS_WITHOUT_TYPE = ['故事名片', '世界与开场', '关键角色', '保存 / 发布'];

const CREATION_TYPES = [
  {
    key: 'adventure',
    label: '世界冒险',
    icon: '⚔️',
    desc: '从零搭建世界舞台，展开属于你的沉浸式冒险故事。',
    lockedPlayType: 'world',
    inferPlayTypes: ['world', 'dungeon'],
  },
  {
    key: 'companion',
    label: '角色互动',
    icon: '💕',
    desc: '围绕关键角色展开互动；当前 Demo 会先按“角色互动 / 陪伴”入口收录，适合做恋爱或陪伴向草稿。',
    lockedPlayType: 'companion',
    inferPlayTypes: ['companion', 'romance'],
  },
  {
    key: 'role_play',
    label: '角色扮演',
    icon: '🎭',
    desc: '让玩家直接代入角色身份，用角色视角推进整段剧情。',
    lockedPlayType: 'role_play',
    inferPlayTypes: ['role_play'],
  },
] as const;

function inferCreationType(playType: string) {
  return CREATION_TYPES.find((ct) => (ct.inferPlayTypes as readonly string[]).includes(playType)) || CREATION_TYPES[0];
}

const GENRE_GRADIENTS = SITE_CONFIG.genreGradients;

const EMPTY_CHARACTER: Character = {
  id: '',
  name: '',
  role: 'npc',
  personality: '',
  background: '',
  appearance: '',
  speakingStyle: '',
  firstMeeting: '',
  isPlayable: false,
  isMainCompanion: false,
};

const INITIAL_FORM: WorkshopForm = {
  title: '',
  description: '',
  genre: '',
  playType: 'world',
  narrativeMode: '',
  difficulty: 'normal',
  worldDescription: '',
  worldRules: '',
  opening: '',
};

const DRAFT_STORAGE_KEY_PREFIX = 'ruxi-workshop-draft-';

const ROLE_OPTIONS: { key: Character['role']; label: string }[] = [
  { key: 'npc', label: 'NPC' },
  { key: 'antagonist', label: '反派' },
  { key: 'companion', label: '同伴' },
];

function getDraftStorageKey(editId: string | null) {
  return `${DRAFT_STORAGE_KEY_PREFIX}${editId || 'new'}`;
}

function normalizeDraftCharacter(character: Partial<Character> | null | undefined, fallbackId: string): Character {
  return {
    ...EMPTY_CHARACTER,
    ...(character ?? {}),
    id: character?.id ? String(character.id) : fallbackId,
    role: character?.role === 'antagonist' ? 'antagonist' : character?.role === 'companion' ? 'companion' : 'npc',
    isPlayable: Boolean(character?.isPlayable),
    isMainCompanion: Boolean(character?.isMainCompanion),
  };
}

function parseDraft(rawDraft: string): WorkshopDraft | null {
  try {
    const parsed = JSON.parse(rawDraft) as Partial<WorkshopDraft> & {
      form?: Partial<WorkshopForm>;
      characters?: Partial<Character>[];
      editingChar?: Partial<Character> | null;
    };

    if (!parsed || typeof parsed !== 'object' || !parsed.form) return null;

    return {
      version: 1,
      creationType: typeof parsed.creationType === 'string' ? parsed.creationType : null,
      step: typeof parsed.step === 'number' && Number.isFinite(parsed.step) ? parsed.step : 0,
      form: { ...INITIAL_FORM, ...parsed.form },
      characters: Array.isArray(parsed.characters)
        ? parsed.characters.map((character, index) => normalizeDraftCharacter(character, `draft-${index}`))
        : [],
      editingChar: parsed.editingChar ? normalizeDraftCharacter(parsed.editingChar, 'draft-editing') : null,
    };
  } catch {
    return null;
  }
}

function createDraftSnapshot(data: Omit<WorkshopDraft, 'version'>): WorkshopDraft {
  return {
    version: 1,
    ...data,
  };
}

function serializeDraft(draft: WorkshopDraft): string {
  return JSON.stringify({
    creationType: draft.creationType,
    step: draft.step,
    form: draft.form,
    characters: draft.characters,
    editingChar: draft.editingChar,
  });
}

const WORLD_LIMITS = {
  title: SITE_CONFIG.limits.world.titleMaxLength,
  description: SITE_CONFIG.limits.world.descriptionMaxLength,
  worldDescription: SITE_CONFIG.limits.world.settingMaxLength,
  worldRules: SITE_CONFIG.limits.world.rulesMaxLength,
  opening: SITE_CONFIG.limits.world.openingMaxLength,
  maxCharacters: SITE_CONFIG.limits.world.maxCharacters,
} as const;

const CHARACTER_LIMITS = {
  name: SITE_CONFIG.limits.character.nameMaxLength,
  personality: SITE_CONFIG.limits.character.personalityMaxLength,
  background: SITE_CONFIG.limits.character.backgroundMaxLength,
  appearance: SITE_CONFIG.limits.character.appearanceMaxLength,
  speakingStyle: SITE_CONFIG.limits.character.speechStyleMaxLength,
  firstMeeting: SITE_CONFIG.limits.character.greetingMaxLength,
} as const;

const PUBLISH_FIELD_LABELS: Record<string, string> = {
  title: '世界名称',
  description: '简介',
  genre: '题材',
  narrativeMode: '叙事模式',
  worldDescription: '世界观描述',
  worldRules: '世界规则',
  opening: '开场白',
  characters: '角色设定',
};

function clampText(value: string, maxLength: number): string {
  return truncateText(value, maxLength);
}

function getPublishIssueEntries(errors: Record<string, string>) {
  return Object.entries(errors).map(([key, message]) => ({
    key,
    label: PUBLISH_FIELD_LABELS[key] || key,
    message,
  }));
}

function getPublishIssueSummary(errors: Record<string, string>) {
  const entries = getPublishIssueEntries(errors);
  if (entries.length === 0) return '';
  if (entries.length <= 3) return `发布前还差：${entries.map((entry) => entry.label).join('、')}`;
  return `发布前还差 ${entries.length} 项：${entries.slice(0, 3).map((entry) => entry.label).join('、')} 等`;
}

/* ── Page Component ────────────────────────────────────── */

export default function WorldEditorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" /></div>}>
      <WorldEditorContent />
    </Suspense>
  );
}

function WorldEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditMode = Boolean(editId);
  const draftStorageKey = getDraftStorageKey(editId);
  const { user, loading: authLoading } = useAuth();
  const [creationType, setCreationType] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WorkshopForm>({ ...INITIAL_FORM });
  const [characters, setCharacters] = useState<Character[]>([]);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [draftStorageReady, setDraftStorageReady] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(isEditMode);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSnapshotRef = useRef<WorkshopDraft | null>(null);
  const skipDraftPersistenceRef = useRef(false);
  const baseDraftRef = useRef<WorkshopDraft>(
    createDraftSnapshot({
      creationType: null,
      step: 0,
      form: { ...INITIAL_FORM },
      characters: [],
      editingChar: null,
    })
  );
  /** 编辑模式下从 API 读出的 protagonist_template，不在表单中编辑，保存时原样写回，避免被 DELETE+INSERT 误删 */
  const preservedProtagonistTemplatesRef = useRef<Record<string, unknown>[]>([]);
  const totalCharacterCount = characters.length + preservedProtagonistTemplatesRef.current.length;
  const remainingCharacterSlots = Math.max(0, WORLD_LIMITS.maxCharacters - totalCharacterCount);
  const reachedCharacterLimit = remainingCharacterSlots === 0;

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (!message.trim()) return;
    toast[type](message);
  };

  const clearDraftStorage = () => {
    safeStorage.removeItem(draftStorageKey);
  };

  const applyDraft = (draft: WorkshopDraft, options?: { showRestoredToast?: boolean }) => {
    setCreationType(draft.creationType);
    setStep(Math.max(0, Math.min(draft.step, (isEditMode ? STEPS_WITHOUT_TYPE : STEPS_WITH_TYPE).length - 1)));
    setForm({ ...INITIAL_FORM, ...draft.form });
    setCharacters(draft.characters.map((character, index) => normalizeDraftCharacter(character, `draft-${index}`)));
    setEditingChar(draft.editingChar ? normalizeDraftCharacter(draft.editingChar, 'draft-editing') : null);
    setErrors({});
    setIsDirty(true);
    if (options?.showRestoredToast) showToast('已恢复本地草稿', 'info');
  };

  const buildCurrentDraft = () =>
    createDraftSnapshot({
      creationType,
      step,
      form,
      characters,
      editingChar,
    });

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      const redirectTarget = ROUTES.workshopCreate(editId ?? undefined);
      router.push(ROUTES.auth(redirectTarget));
    }
  }, [authLoading, user, router, editId]);

  useEffect(() => {
    skipDraftPersistenceRef.current = false;
    setDraftStorageReady(false);
    setEditLoadError(null);
    draftSnapshotRef.current = null;
    baseDraftRef.current = createDraftSnapshot({
      creationType: null,
      step: 0,
      form: { ...INITIAL_FORM },
      characters: [],
      editingChar: null,
    });

    let draft: WorkshopDraft | null = null;
    const rawDraft = safeStorage.getItem(draftStorageKey);
    if (rawDraft) {
      draft = parseDraft(rawDraft);
      if (!draft) {
        safeStorage.removeItem(draftStorageKey);
        showToast('本地草稿已损坏，已自动忽略', 'error');
      }
    }

    draftSnapshotRef.current = draft;
    preservedProtagonistTemplatesRef.current = [];
    setErrors({});

    if (!isEditMode) {
      if (draft) {
        applyDraft(draft, { showRestoredToast: true });
      } else {
        setCreationType(null);
        setStep(0);
        setForm({ ...INITIAL_FORM });
        setCharacters([]);
        setEditingChar(null);
        setIsDirty(false);
      }
      setIsEditLoading(false);
      setDraftStorageReady(true);
      return;
    }

    setCreationType(null);
    setStep(0);
    setForm({ ...INITIAL_FORM });
    setCharacters([]);
    setEditingChar(null);
    setIsDirty(false);
    setIsEditLoading(true);
  }, [draftStorageKey, isEditMode]);

  useEffect(() => {
    if (!isEditMode || !editId) return;
    if (authLoading || !user) return;

    const controller = new AbortController();
    setIsEditLoading(true);
    setEditLoadError(null);

    const loadWorld = async () => {
      try {
        const res = await worldsAPI.get(editId, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const world = (res as { data?: Record<string, unknown> }).data || res;
        const w = world as Record<string, unknown>;
        const loadedForm: WorkshopForm = {
          title: (w.title as string) || '',
          description: (w.description as string) || '',
          genre: (w.genre as string) || '',
          playType: (w.play_type as string) || 'world',
          worldDescription: (w.setting as string) || '',
          worldRules: (w.rules as string) || '',
          opening: (w.opening as string) || '',
          narrativeMode: (w.narrative_mode as string) || 'adventure',
          difficulty: (w.difficulty as string) || 'normal',
        };
        const loadedPlayType = (w.play_type as string) || 'world';
        const inferredType = inferCreationType(loadedPlayType);

        const chars = w.characters as Array<Record<string, unknown>> | undefined;
        preservedProtagonistTemplatesRef.current = [];
        const parseLorebook = (val: unknown): unknown[] => {
          if (Array.isArray(val)) return val;
          if (typeof val === 'string') {
            try {
              const p = JSON.parse(val) as unknown;
              return Array.isArray(p) ? p : [];
            } catch {
              return [];
            }
          }
          return [];
        };
        const editableChars = (chars || []).filter((c) => {
          if (c.role === 'protagonist_template') {
            preservedProtagonistTemplatesRef.current.push({
              name: (c.name as string) || '',
              role: 'protagonist_template',
              personality: (c.personality as string) || '',
              background: (c.background as string) || '',
              appearance: (c.appearance as string) || '',
              speech_style: (c.speech_style as string) || '',
              greeting: (c.greeting as string) || '',
              avatar_url: c.avatar_url ?? null,
              abilities: (c.abilities as string) || '',
              lorebook: parseLorebook(c.lorebook),
            });
            return false;
          }
          return true;
        });
        const loadedCharacters: Character[] = editableChars.map((c, i) => ({
          id: c.id != null ? String(c.id) : `loaded-${i}`,
          name: (c.name as string) || '',
          role:
            c.role === 'antagonist'
              ? 'antagonist'
              : c.role === 'companion'
                ? 'companion'
                : 'npc',
          personality: (c.personality as string) || '',
          background: (c.background as string) || '',
          appearance: (c.appearance as string) || '',
          speakingStyle: (c.speech_style as string) || '',
          firstMeeting: (c.greeting as string) || '',
          isPlayable: Boolean(c.is_playable),
          isMainCompanion: Boolean(c.is_main_companion),
        }));
        const serverDraft = createDraftSnapshot({
          creationType: inferredType.key,
          step: 0,
          form: loadedForm,
          characters: loadedCharacters,
          editingChar: null,
        });

        baseDraftRef.current = serverDraft;

        if (draftSnapshotRef.current) {
          applyDraft(draftSnapshotRef.current, { showRestoredToast: true });
        } else {
          setForm(loadedForm);
          setCharacters(loadedCharacters);
          setEditingChar(null);
          setCreationType(inferredType.key);
          setStep(0);
          setErrors({});
          setIsDirty(false);
        }

        setEditLoadError(null);
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : '加载世界失败，请重试';
        setEditLoadError(message);
        setCreationType(null);
        setStep(0);
        setForm({ ...INITIAL_FORM });
        setCharacters([]);
        setEditingChar(null);
        setErrors({});
        setIsDirty(false);
        showToast(message, 'error');
      } finally {
        if (!controller.signal.aborted) {
          setIsEditLoading(false);
          setDraftStorageReady(true);
        }
      }
    };
    void loadWorld();

    return () => {
      controller.abort();
    };
  }, [editId, authLoading, user, isEditMode]);

  useEffect(() => {
    if (!draftStorageReady || editLoadError || skipDraftPersistenceRef.current || (isEditMode && isEditLoading)) return;

    const currentDraft = buildCurrentDraft();
    if (serializeDraft(currentDraft) === serializeDraft(baseDraftRef.current)) {
      clearDraftStorage();
      return;
    }

    const timer = window.setTimeout(() => {
      safeStorage.setItem(draftStorageKey, JSON.stringify(currentDraft));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [creationType, step, form, characters, editingChar, draftStorageReady, editLoadError, isEditMode, isEditLoading, draftStorageKey, isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleSubmit = async (status: 'published' | 'draft') => {
    if (submitting) return;

    if (editingChar) {
      setStep(2 + contentOffset);
      showToast('请先保存或取消当前角色编辑', 'error');
      return;
    }

    if (status === 'published') {
      const validationErrors = getPublishValidationErrors();
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        showToast(getPublishIssueSummary(validationErrors), 'error');
        if (validationErrors.title || validationErrors.genre || validationErrors.narrativeMode) {
          setStep(0 + contentOffset);
        } else if (validationErrors.worldDescription || validationErrors.opening || validationErrors.worldRules) {
          setStep(1 + contentOffset);
        } else if (validationErrors.characters) {
          setStep(2 + contentOffset);
        }
        return;
      }
    }

    setSubmitting(true);
    try {
      const editablePayload = characters.map((c) => ({
        name: c.name,
        role: c.role,
        personality: c.personality,
        background: c.background,
        appearance: c.appearance,
        speech_style: c.speakingStyle,
        greeting: c.firstMeeting,
        is_playable: c.isPlayable || false,
        is_main_companion: c.isMainCompanion || false,
      }));
      const preserved = preservedProtagonistTemplatesRef.current;
      const charactersPayload =
        editId && preserved.length > 0
          ? [...preserved, ...editablePayload].map((c, i) => ({ ...c, sort_order: i }))
          : editablePayload;

      const data = {
        title: form.title,
        description: form.description || form.worldDescription.slice(0, WORLD_LIMITS.description),
        genre: form.genre,
        play_type: form.playType,
        narrative_mode: form.narrativeMode,
        difficulty: form.difficulty,
        setting: form.worldDescription,
        rules: form.worldRules,
        opening: form.opening,
        status,
        is_public: status === 'published' ? true : undefined,
        characters: charactersPayload,
      };
      if (editId) {
        await worldsAPI.update(editId, data);
      } else {
        await worldsAPI.create(data);
      }

      baseDraftRef.current = createDraftSnapshot({
        creationType,
        step,
        form,
        characters,
        editingChar: null,
      });

      if (status === 'published') {
        skipDraftPersistenceRef.current = true;
        clearDraftStorage();
      }

      setIsDirty(false);
      showToast(
        editId
          ? status === 'draft'
            ? '草稿已更新'
            : '内测世界已更新'
          : status === 'draft'
            ? '草稿已保存'
            : '已发布到工坊内测',
        'success'
      );
      redirectTimerRef.current = setTimeout(() => router.push(ROUTES.workshop), status === 'published' ? 1600 : 1000);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : '操作失败，请重试', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const ensureAiContext = (type: 'setting' | 'rules' | 'opening' | 'character') => {
    const hasBasicContext = Boolean(form.title.trim() || form.genre || form.description.trim());
    const hasWorldContext = Boolean(form.worldDescription.trim() || form.opening.trim() || form.worldRules.trim());

    if (type === 'character') {
      if (hasBasicContext || hasWorldContext) return true;
      showToast('先补一点世界名称、题材、简介或世界观，再让 AI 帮你生成角色会更准', 'info');
      return false;
    }

    if (hasBasicContext || hasWorldContext) return true;
    showToast('先填世界名称、题材或一句简介，AI 才能更贴近你的设定', 'info');
    return false;
  };

  const handleAIGenerate = async (type: 'setting' | 'rules' | 'opening' | 'character') => {
    if (aiLoading) return;
    if (type === 'character') {
      if (editingChar) {
        showToast('请先保存或取消当前角色编辑', 'error');
        return;
      }
      if (reachedCharacterLimit) {
        showToast(`角色数量最多 ${WORLD_LIMITS.maxCharacters} 个，请先删除一些角色`, 'error');
        return;
      }
    }
    if (!ensureAiContext(type)) return;

    setAiLoading(type);
    try {
      const context: Record<string, string> = {
        title: form.title,
        description: form.description,
        genre: form.genre,
        playType: form.playType,
        narrativeMode: form.narrativeMode,
        difficulty: form.difficulty,
        setting: form.worldDescription,
        rules: form.worldRules,
        opening: form.opening,
        characterCount: String(totalCharacterCount),
        existingCharacters: characters
          .map((character) => `${character.name || '未命名角色'}(${character.role || 'npc'})：性格${character.personality || '待补完'}；背景${character.background || '待补完'}`)
          .join('\n'),
      };
      const res = type === 'character'
        ? await worldsAPI.aiGenerateCharacter(context)
        : await worldsAPI.aiAssist(type, context);
      const content = String(res.data?.content || res.content || '');
      let wasTruncated = false;
      const clampGenerated = (value: string, maxLength: number) => {
        const next = clampText(value, maxLength);
        if (next.length !== value.length) wasTruncated = true;
        return next;
      };

      if (type === 'setting') {
        updateForm('worldDescription', clampGenerated(content, WORLD_LIMITS.worldDescription));
      } else if (type === 'rules') {
        updateForm('worldRules', clampGenerated(content, WORLD_LIMITS.worldRules));
      } else if (type === 'opening') {
        updateForm('opening', clampGenerated(content, WORLD_LIMITS.opening));
      } else if (type === 'character') {
        try {
          const charData = (typeof content === 'string' ? JSON.parse(content) : content) as Record<string, unknown>;
          const newChar: Character = {
            id: `c-${Date.now()}`,
            name: clampGenerated((charData.name as string) || '未命名角色', CHARACTER_LIMITS.name),
            role: charData.role === 'antagonist' ? 'antagonist' : charData.role === 'companion' ? 'companion' : 'npc',
            personality: clampGenerated((charData.personality as string) || '', CHARACTER_LIMITS.personality),
            background: clampGenerated((charData.background as string) || '', CHARACTER_LIMITS.background),
            appearance: clampGenerated((charData.appearance as string) || '', CHARACTER_LIMITS.appearance),
            speakingStyle: clampGenerated((charData.speech_style as string) || '', CHARACTER_LIMITS.speakingStyle),
            firstMeeting: clampGenerated((charData.greeting as string) || '', CHARACTER_LIMITS.firstMeeting),
          };
          if (reachedCharacterLimit) {
            showToast(`角色数量最多 ${WORLD_LIMITS.maxCharacters} 个，请先删除一些角色`, 'error');
            return;
          }
          setCharacters((prev) => [...prev, newChar]);
          setIsDirty(true);
          showToast(
            wasTruncated ? `角色「${newChar.name}」已生成，超长内容已自动截断` : `角色「${newChar.name}」已生成`,
            'success'
          );
        } catch {
          showToast('角色数据解析失败，请重试', 'error');
        }
      }

      if (type !== 'character') {
        showToast(wasTruncated ? 'AI 生成完成，超长内容已自动截断' : 'AI 生成完成', 'success');
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'AI 生成失败，请重试', 'error');
    } finally {
      setAiLoading(null);
    }
  };

  const updateForm = (key: string, value: string) => {
    setIsDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const getPublishValidationErrors = () => {
    const e: Record<string, string> = {};
    const totalCharacterCount = characters.length + preservedProtagonistTemplatesRef.current.length;
    if (!form.title.trim()) e.title = '请输入世界名称';
    else if (getTextLength(form.title) > WORLD_LIMITS.title) e.title = `世界名称不能超过 ${WORLD_LIMITS.title} 字`;
    if (getTextLength(form.description) > WORLD_LIMITS.description) e.description = `简介不能超过 ${WORLD_LIMITS.description} 字`;
    if (!form.genre) e.genre = '请选择题材';
    if (!form.narrativeMode) e.narrativeMode = '请选择叙事模式';
    if (!form.worldDescription.trim()) e.worldDescription = '请描述世界观';
    else if (getTextLength(form.worldDescription) > WORLD_LIMITS.worldDescription) e.worldDescription = `世界观描述不能超过 ${WORLD_LIMITS.worldDescription} 字`;
    if (getTextLength(form.worldRules) > WORLD_LIMITS.worldRules) e.worldRules = `世界规则不能超过 ${WORLD_LIMITS.worldRules} 字`;
    if (!form.opening.trim()) e.opening = '请输入开场白';
    else if (getTextLength(form.opening) > WORLD_LIMITS.opening) e.opening = `开场白不能超过 ${WORLD_LIMITS.opening} 字`;
    if (totalCharacterCount === 0) {
      e.characters = '请至少添加一个角色';
    } else if (form.playType === 'role_play' && !characters.some((char) => char.isPlayable)) {
      e.characters = '角色扮演类型至少需要一个可代入角色';
    } else if (form.playType === 'companion' && !characters.some((char) => char.isMainCompanion)) {
      e.characters = '角色互动类型至少需要一个主要互动角色';
    }
    return e;
  };

  const validateStep = () => {
    const e: Record<string, string> = {};
    // 前置步骤：选择创作类型
    if (!isEditMode && step === 0) {
      if (!creationType) { showToast('请选择创作类型', 'error'); return false; }
      return true;
    }
    const contentStep = step - contentOffset;
    if (contentStep === 0) {
      if (!form.title.trim()) e.title = '请输入世界名称';
      else if (getTextLength(form.title) > WORLD_LIMITS.title) e.title = `世界名称不能超过 ${WORLD_LIMITS.title} 字`;
      if (getTextLength(form.description) > WORLD_LIMITS.description) e.description = `简介不能超过 ${WORLD_LIMITS.description} 字`;
      if (!form.genre) e.genre = '请选择题材';
      if (!form.narrativeMode) e.narrativeMode = '请选择叙事模式';
    }
    if (contentStep === 1) {
      if (!form.worldDescription.trim()) e.worldDescription = '请描述世界观';
      else if (getTextLength(form.worldDescription) > WORLD_LIMITS.worldDescription) e.worldDescription = `世界观描述不能超过 ${WORLD_LIMITS.worldDescription} 字`;
      if (getTextLength(form.worldRules) > WORLD_LIMITS.worldRules) e.worldRules = `世界规则不能超过 ${WORLD_LIMITS.worldRules} 字`;
      if (!form.opening.trim()) e.opening = '请输入开场白';
      else if (getTextLength(form.opening) > WORLD_LIMITS.opening) e.opening = `开场白不能超过 ${WORLD_LIMITS.opening} 字`;
    }
    if (contentStep === 2 && editingChar) {
      showToast('请先保存或取消当前角色编辑', 'error');
      return false;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => {
    if (validateStep()) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const addCharacter = () => {
    if (editingChar) {
      showToast('请先保存或取消当前角色编辑', 'error');
      return;
    }
    if (reachedCharacterLimit) {
      showToast(`角色数量最多 ${WORLD_LIMITS.maxCharacters} 个，请先删除一些角色`, 'error');
      return;
    }
    setEditingChar({ ...EMPTY_CHARACTER, id: `c-${Date.now()}` });
  };

  const saveCharacter = () => {
    if (!editingChar) return;
    if (!editingChar.name.trim()) {
      showToast('请输入角色名字', 'error');
      return;
    }

    const exists = characters.some((c) => c.id === editingChar.id);
    if (!exists && reachedCharacterLimit) {
      showToast(`角色数量最多 ${WORLD_LIMITS.maxCharacters} 个，请先删除一些角色`, 'error');
      return;
    }

    setIsDirty(true);
    setCharacters((prev) => {
      if (exists) return prev.map((c) => (c.id === editingChar.id ? editingChar : c));
      return [...prev, editingChar];
    });
    setEditingChar(null);
  };

  const handleEditCharacter = (char: Character) => {
    if (editingChar && editingChar.id !== char.id) {
      showToast('请先保存或取消当前角色编辑', 'error');
      return;
    }
    setEditingChar({ ...char });
  };

  const handleDeleteCharacter = (id: string) => {
    if (editingChar && editingChar.id !== id) {
      showToast('请先保存或取消当前角色编辑', 'error');
      return;
    }
    setIsDirty(true);
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    if (editingChar?.id === id) setEditingChar(null);
  };

  const STEPS = isEditMode ? STEPS_WITHOUT_TYPE : STEPS_WITH_TYPE;
  /** 内容步骤偏移量：编辑模式无前置步骤，偏移 0；新建模式有前置步骤，偏移 1 */
  const contentOffset = isEditMode ? 0 : 1;
  const selectedCreationType = creationType
    ? CREATION_TYPES.find((ct) => ct.key === creationType) || inferCreationType(form.playType)
    : isEditMode
      ? inferCreationType(form.playType)
      : null;
  const genre = SITE_CONFIG.genres.find((g) => g.key === form.genre);
  const playType = SITE_CONFIG.playTypes.find((p) => p.key === form.playType);
  const narrativeMode = SITE_CONFIG.narrativeModes.find((m) => m.key === form.narrativeMode);
  const gradient = GENRE_GRADIENTS[form.genre] || 'from-gray-400 to-gray-300';
  const isAnyAiLoading = aiLoading !== null;
  const publishIssueEntries = getPublishIssueEntries(getPublishValidationErrors());
  const publishReady = publishIssueEntries.length === 0;

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center text-sm text-gray-500">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <p className="mt-4">{authLoading ? '正在验证登录状态...' : '正在跳转到登录页...'}</p>
        </div>
      </div>
    );
  }

  if (isEditMode && isEditLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center text-sm text-gray-500">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <p className="mt-4">正在加载世界内容...</p>
        </div>
      </div>
    );
  }

  if (isEditMode && editLoadError) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center px-4 py-8 sm:px-6">
        <div className="w-full rounded-3xl border border-red-100 bg-white p-8 shadow-sm">
          <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">编辑加载失败</span>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">当前世界没有加载成功，已阻止继续编辑</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            {editLoadError}
          </p>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            为了避免空表单被误认为新建内容，本页不会继续展示编辑器。请返回工坊后重试，或确认该世界仍然存在且你有编辑权限。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push(ROUTES.workshop)}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark cursor-pointer"
            >
              返回工坊
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 cursor-pointer"
            >
              重新加载
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[80rem] px-4 py-8 sm:px-6 xl:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? '编辑内测世界' : '创建内测世界'}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isEditMode ? '继续完善你的设定，修改后可保存草稿或重新发布到当前内测区。' : '先选一条创作路线，再用最小可玩流程把世界、角色和开场搭出来。'}
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
          <span className="inline-flex w-fit rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 shadow-sm">
            Demo / 内测
          </span>
          <div>
            <p className="text-sm font-semibold text-amber-900">工坊现在先保留最小创作流程</p>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              当前先开放设定整理、草稿保存与基础发布；封面、作者页和更完整的运营能力会继续补齐，所以这里更适合先把世界做成一版可玩的内测稿。
            </p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  i <= step ? 'bg-brand text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i < step ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`mt-1 text-xs hidden sm:block ${i <= step ? 'text-brand font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-brand' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0 (新建模式): 选择创作类型 */}
      {!isEditMode && step === 0 && (
        <div className="rounded-2xl bg-white shadow-sm p-6 sm:p-8 space-y-6">
          <h2 className="text-lg font-bold text-gray-900">先选一条创作路线</h2>
          <p className="text-sm text-gray-500">这里先做减法：选好路线后，会自动带你走完“故事名片 → 世界与开场 → 关键角色 → 保存 / 发布”这条最小流程。</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {CREATION_TYPES.map((ct) => (
              <button
                key={ct.key}
                type="button"
                onClick={() => {
                  setIsDirty(true);
                  setCreationType(ct.key);
                  setForm((prev) => ({ ...prev, playType: ct.lockedPlayType }));
                }}
                className={`rounded-xl border-2 p-5 text-left transition-all cursor-pointer ${
                  creationType === ct.key
                    ? 'border-brand bg-brand-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-3xl">{ct.icon}</span>
                <p className={`mt-3 text-sm font-semibold ${creationType === ct.key ? 'text-brand' : 'text-gray-800'}`}>
                  {ct.label}
                </p>
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">{ct.desc}</p>
              </button>
            ))}
          </div>
          {selectedCreationType && (
            <div className="rounded-2xl border border-brand/15 bg-brand-50/60 px-4 py-4 text-sm">
              <p className="font-semibold text-gray-900">
                已选择 {selectedCreationType.icon} {selectedCreationType.label}
              </p>
              <p className="mt-1 leading-6 text-gray-600">
                这一类会自动锁定为「{SITE_CONFIG.playTypes.find((item) => item.key === selectedCreationType.lockedPlayType)?.name || selectedCreationType.lockedPlayType}」入口；下一步只需要先补世界名称、题材、叙事模式和开场。{selectedCreationType.key === 'companion' ? ' 当前 Demo 会先按“角色互动 / 陪伴”入口展示。' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 1: 故事名片 */}
      {step === (0 + contentOffset) && (
        <div className="rounded-2xl bg-white shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">故事名片</h2>
              <p className="mt-1 text-xs leading-5 text-gray-500">先把世界卡片上最先被看到的内容填好：名称、题材、叙事模式是主字段；简介和难度都先放到补充层。</p>
            </div>
            {selectedCreationType && (
              <div className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand">
                {selectedCreationType.icon} {selectedCreationType.label}
              </div>
            )}
          </div>

          {/* 世界名称 */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              世界名称 <span className="text-red-400">*</span>
            </label>
            <input
              id="title"
              type="text"
              maxLength={WORLD_LIMITS.title}
              value={form.title}
              onChange={(e) => updateForm('title', clampText(e.target.value, WORLD_LIMITS.title))}
              placeholder="给你的世界起个名字"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <div className="flex justify-between mt-1">
              {errors.title ? <p className="text-xs text-red-500">{errors.title}</p> : <span />}
              <span className="text-xs text-gray-400">{getTextLength(form.title)}/{WORLD_LIMITS.title}</span>
            </div>
          </div>

          {/* 简介 */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              一句简介（选填）
            </label>
            <textarea
              id="description"
              rows={3}
              maxLength={WORLD_LIMITS.description}
              value={form.description}
              onChange={(e) => updateForm('description', clampText(e.target.value, WORLD_LIMITS.description))}
              placeholder="一句话描述这个世界最先抓人的地方；不填时会默认截取世界观前一段。"
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none resize-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <div className="mt-1 flex justify-between">
              {errors.description ? <p className="text-xs text-red-500">{errors.description}</p> : <span />}
              <span className="text-xs text-gray-400">{getTextLength(form.description)}/{WORLD_LIMITS.description}</span>
            </div>
          </div>

          {/* 题材 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              题材 <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SITE_CONFIG.genres.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => updateForm('genre', g.key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                    form.genre === g.key
                      ? 'text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={form.genre === g.key ? { backgroundColor: g.color } : undefined}
                >
                  {g.icon} {g.name}
                </button>
              ))}
            </div>
            {errors.genre && <p className="mt-1 text-xs text-red-500">{errors.genre}</p>}
          </div>

          {/* 叙事模式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              叙事模式 <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SITE_CONFIG.narrativeModes.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => updateForm('narrativeMode', mode.key)}
                  className={`rounded-xl border-2 p-4 text-left transition-all cursor-pointer ${
                    form.narrativeMode === mode.key
                      ? 'border-brand bg-brand-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className={`text-sm font-semibold ${form.narrativeMode === mode.key ? 'text-brand' : 'text-gray-800'}`}>
                    {mode.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed">{mode.desc}</p>
                </button>
              ))}
            </div>
            {errors.narrativeMode && <p className="mt-1 text-xs text-red-500">{errors.narrativeMode}</p>}
          </div>

          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-sm font-semibold text-gray-900">补充设置（选填）</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">这些内容不会挡住主流程：先把世界做出来，再慢慢补细节也可以。</p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">难度</label>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => updateForm('difficulty', d.key)}
                    className={`rounded-lg px-5 py-2 text-sm font-medium transition-all cursor-pointer ${
                      form.difficulty === d.key
                        ? 'bg-brand text-white'
                        : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-gray-500">封面上传仍在内测中，当前会默认使用题材渐变封面，不需要你先处理。</p>
          </div>
        </div>
      )}

      {/* Step 2: 世界与开场 */}
      {step === (1 + contentOffset) && (
        <div className="rounded-2xl bg-white shadow-sm p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">世界与开场</h2>
            <p className="mt-1 text-xs leading-5 text-gray-500">这里先分主次：世界观和开场是发布前必须补齐的主字段，世界规则是辅助信息；AI 只负责草拟，你仍然可以继续微调。</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="worldDesc" className="text-sm font-medium text-gray-700">
                世界观描述 <span className="text-red-400">*</span>
              </label>
              <button type="button" onClick={() => handleAIGenerate('setting')} disabled={isAnyAiLoading} className="text-xs text-brand hover:underline cursor-pointer disabled:opacity-50">
                {aiLoading === 'setting' ? (
                  <span className="inline-flex items-center gap-1"><svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>生成中...</span>
                ) : '✨ AI 帮我写'}
              </button>
            </div>
            <textarea
              id="worldDesc"
              rows={5}
              maxLength={WORLD_LIMITS.worldDescription}
              value={form.worldDescription}
              onChange={(e) => updateForm('worldDescription', clampText(e.target.value, WORLD_LIMITS.worldDescription))}
              placeholder="描述这个世界的背景、历史、规则..."
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none resize-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <div className="flex justify-between mt-1">
              {errors.worldDescription ? <p className="text-xs text-red-500">{errors.worldDescription}</p> : <span />}
              <span className="text-xs text-gray-400">{getTextLength(form.worldDescription)}/{WORLD_LIMITS.worldDescription}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="worldRules" className="text-sm font-medium text-gray-700">世界规则</label>
              <button type="button" onClick={() => handleAIGenerate('rules')} disabled={isAnyAiLoading} className="text-xs text-brand hover:underline cursor-pointer disabled:opacity-50">
                {aiLoading === 'rules' ? (
                  <span className="inline-flex items-center gap-1"><svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>生成中...</span>
                ) : '✨ AI 帮我写'}
              </button>
            </div>
            <textarea
              id="worldRules"
              rows={4}
              maxLength={WORLD_LIMITS.worldRules}
              value={form.worldRules}
              onChange={(e) => updateForm('worldRules', clampText(e.target.value, WORLD_LIMITS.worldRules))}
              placeholder="这个世界有什么特殊规则？比如修仙体系、科技水平..."
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none resize-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <div className="mt-1 flex justify-between">
              {errors.worldRules ? <p className="text-xs text-red-500">{errors.worldRules}</p> : <span />}
              <span className="text-xs text-gray-400">{getTextLength(form.worldRules)}/{WORLD_LIMITS.worldRules}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="opening" className="text-sm font-medium text-gray-700">
                开场白 <span className="text-red-400">*</span>
              </label>
              <button type="button" onClick={() => handleAIGenerate('opening')} disabled={isAnyAiLoading} className="text-xs text-brand hover:underline cursor-pointer disabled:opacity-50">
                {aiLoading === 'opening' ? (
                  <span className="inline-flex items-center gap-1"><svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>生成中...</span>
                ) : '✨ AI 帮我写'}
              </button>
            </div>
            <textarea
              id="opening"
              rows={4}
              maxLength={WORLD_LIMITS.opening}
              value={form.opening}
              onChange={(e) => updateForm('opening', clampText(e.target.value, WORLD_LIMITS.opening))}
              placeholder="玩家进入世界时看到的第一段文字..."
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none resize-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <div className="flex justify-between mt-1">
              {errors.opening ? <p className="text-xs text-red-500">{errors.opening}</p> : <span />}
              <span className="text-xs text-gray-400">{getTextLength(form.opening)}/{WORLD_LIMITS.opening}</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: 关键角色 */}
      {step === (2 + contentOffset) && (
        <div className="rounded-2xl bg-white shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">关键角色</h2>
              <p className="mt-1 text-xs text-gray-500">已添加 {totalCharacterCount}/{WORLD_LIMITS.maxCharacters} 个角色{remainingCharacterSlots > 0 ? `，还能继续添加 ${remainingCharacterSlots} 个` : '，已达到上限'}。</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">这里先聚焦“谁会把故事真正带起来”。AI 角色会参考已填世界名称、世界观和现有角色；如果你正在编辑某个角色，先保存或取消再切换。</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addCharacter}
                disabled={Boolean(editingChar) || reachedCharacterLimit}
                className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                + 手动添加角色
              </button>
              <button
                type="button"
                onClick={() => handleAIGenerate('character')}
                disabled={isAnyAiLoading || Boolean(editingChar) || reachedCharacterLimit}
                className="rounded-lg border border-brand px-4 py-1.5 text-sm font-medium text-brand hover:bg-brand-50 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                {aiLoading === 'character' ? (
                  <span className="inline-flex items-center gap-1"><svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>生成中...</span>
                ) : '✨ AI 草拟角色'}
              </button>
            </div>
          </div>

          {(form.playType === 'role_play' || form.playType === 'companion') && (
            <div className="rounded-xl border border-brand/15 bg-brand-50/40 px-4 py-3 text-sm text-gray-600">
              <p className="font-medium text-gray-800">
                {form.playType === 'role_play' ? '发布前至少勾选 1 个「可代入角色」' : '发布前至少勾选 1 个「主要互动角色」'}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                这样玩家进入时，系统才能准确知道要代入谁，或优先和谁展开关键互动。
              </p>
            </div>
          )}

          {/* Character List */}
          {characters.length === 0 && !editingChar && (
            <div className="flex flex-col items-center py-12 text-gray-400">
              <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              <p className="text-sm">还没有关键角色，先手动添加一个，或让 AI 草拟一版</p>
            </div>
          )}

          <div className="space-y-3">
            {characters.map((char) => (
              <div key={char.id} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-sm font-bold text-brand shrink-0">
                  {getDisplayInitial(char.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-800">{char.name}</p>
                  <p className="line-clamp-1 text-xs text-gray-500 break-words">
                    {ROLE_OPTIONS.find((r) => r.key === char.role)?.label} · {char.personality || '未设置性格'}
                    {char.isPlayable && <span className="ml-1 text-brand">🎭 可代入</span>}
                    {char.isMainCompanion && <span className="ml-1 text-brand">🤝 主要互动</span>}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditCharacter(char)}
                    className="text-xs text-brand hover:underline cursor-pointer"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCharacter(char.id)}
                    className="text-xs text-red-500 hover:underline cursor-pointer"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Character Editor Modal */}
          {editingChar && (
            <div className="rounded-xl border-2 border-brand/30 bg-brand-50/30 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-800">
                {characters.find((c) => c.id === editingChar.id) ? '编辑角色' : '新建角色'}
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">名字 *</label>
                  <input
                    type="text"
                    maxLength={CHARACTER_LIMITS.name}
                    value={editingChar.name}
                    onChange={(e) => setEditingChar({ ...editingChar, name: clampText(e.target.value, CHARACTER_LIMITS.name) })}
                    placeholder="角色名字"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                  <div className="mt-0.5 flex justify-end">
                    <span className="text-xs text-gray-400">{getTextLength(editingChar.name)}/{CHARACTER_LIMITS.name}</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">身份</label>
                  <div className="flex gap-2">
                    {ROLE_OPTIONS.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setEditingChar({ ...editingChar, role: r.key })}
                        className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all cursor-pointer ${
                          editingChar.role === r.key ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">性格</label>
                <input
                  type="text"
                  maxLength={CHARACTER_LIMITS.personality}
                  value={editingChar.personality}
                  onChange={(e) => setEditingChar({ ...editingChar, personality: clampText(e.target.value, CHARACTER_LIMITS.personality) })}
                  placeholder="例如：沉稳内敛，心思缜密"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                />
                <div className="mt-0.5 flex justify-end">
                  <span className="text-xs text-gray-400">{getTextLength(editingChar.personality)}/{CHARACTER_LIMITS.personality}</span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">背景</label>
                <textarea
                  rows={2}
                  maxLength={CHARACTER_LIMITS.background}
                  value={editingChar.background}
                  onChange={(e) => setEditingChar({ ...editingChar, background: clampText(e.target.value, CHARACTER_LIMITS.background) })}
                  placeholder="角色的背景故事"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none resize-none focus:border-brand"
                />
                <div className="mt-0.5 flex justify-end">
                  <span className="text-xs text-gray-400">{getTextLength(editingChar.background)}/{CHARACTER_LIMITS.background}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">外貌</label>
                  <input
                    type="text"
                    maxLength={CHARACTER_LIMITS.appearance}
                    value={editingChar.appearance}
                    onChange={(e) => setEditingChar({ ...editingChar, appearance: clampText(e.target.value, CHARACTER_LIMITS.appearance) })}
                    placeholder="外貌描述"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                  <div className="mt-0.5 flex justify-end">
                    <span className="text-xs text-gray-400">{getTextLength(editingChar.appearance)}/{CHARACTER_LIMITS.appearance}</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">说话风格</label>
                  <input
                    type="text"
                    maxLength={CHARACTER_LIMITS.speakingStyle}
                    value={editingChar.speakingStyle}
                    onChange={(e) => setEditingChar({ ...editingChar, speakingStyle: clampText(e.target.value, CHARACTER_LIMITS.speakingStyle) })}
                    placeholder="例如：文绉绉的古风"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                  <div className="mt-0.5 flex justify-end">
                    <span className="text-xs text-gray-400">{getTextLength(editingChar.speakingStyle)}/{CHARACTER_LIMITS.speakingStyle}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">初次见面台词</label>
                <input
                  type="text"
                  maxLength={CHARACTER_LIMITS.firstMeeting}
                  value={editingChar.firstMeeting}

                  onChange={(e) => setEditingChar({ ...editingChar, firstMeeting: clampText(e.target.value, CHARACTER_LIMITS.firstMeeting) })}
                  placeholder="角色第一次见到玩家时说的话"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                />
                <div className="flex justify-end mt-0.5">
                  <span className="text-xs text-gray-400">{getTextLength(editingChar.firstMeeting)}/{CHARACTER_LIMITS.firstMeeting}</span>
                </div>
              </div>

              {/* 角色扮演 / 角色互动 特殊标记 */}
              {(form.playType === 'role_play' || form.playType === 'companion') && (
                <div className="space-y-3 rounded-lg border border-brand/20 bg-brand-50/30 p-4">
                  <p className="text-xs font-medium text-gray-700">
                    {form.playType === 'role_play' ? '🎭 角色扮演模式设置' : '🤝 角色互动模式设置'}
                  </p>
                  {form.playType === 'role_play' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingChar.isPlayable || false}
                        onChange={(e) => setEditingChar({ ...editingChar, isPlayable: e.target.checked })}
                        className="rounded border-gray-300 text-brand focus:ring-brand"
                      />
                      <span className="text-sm text-gray-700">可代入角色</span>
                      <span className="text-xs text-gray-400">（玩家可以扮演此角色进行冒险）</span>
                    </label>
                  )}
                  {form.playType === 'companion' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingChar.isMainCompanion || false}
                        onChange={(e) => setEditingChar({ ...editingChar, isMainCompanion: e.target.checked })}
                        className="rounded border-gray-300 text-brand focus:ring-brand"
                      />
                      <span className="text-sm text-gray-700">主要互动角色</span>
                      <span className="text-xs text-gray-400">（玩家会优先和此角色建立关键关系）</span>
                    </label>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingChar(null)}
                  className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={saveCharacter}
                  className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark cursor-pointer"
                >
                  保存角色
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: 预览与发布 */}
      {step === (3 + contentOffset) && (
        <div className="space-y-6">
          {/* Preview Card */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className={`relative flex h-44 items-center justify-center bg-gradient-to-br ${gradient}`}>
              <span className="text-5xl opacity-80">{genre?.icon || '📖'}</span>
              {genre && (
                <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                  {genre.icon} {genre.name}
                </span>
              )}
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900">{form.title || '未命名世界'}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {playType && (
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand">
                    {playType.icon} {playType.name}
                  </span>
                )}
                {narrativeMode && (
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand">{narrativeMode.name}</span>
                )}
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {DIFFICULTIES.find((d) => d.key === form.difficulty)?.label || '普通'}
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {totalCharacterCount} 个角色
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-gray-600 whitespace-pre-wrap">
                {form.description || '你还没有填写简介，发布后将默认展示世界观前 200 字。'}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700">世界观预览</h3>
              <div className="mt-3 rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-600 whitespace-pre-wrap">
                {form.worldDescription || '暂无世界观内容'}
              </div>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700">规则预览</h3>
              <div className="mt-3 rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-600 whitespace-pre-wrap">
                {form.worldRules || '还没填写世界规则'}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-700">角色预览</h3>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">{totalCharacterCount} 位角色</span>
            </div>
            {characters.length > 0 ? (
              <div className="mt-4 space-y-3">
                {characters.map((char) => (
                  <div key={char.id} className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{char.name || '未命名角色'}</p>
                        <p className="mt-1 text-xs text-gray-500">{ROLE_OPTIONS.find((r) => r.key === char.role)?.label || 'NPC'}</p>
                      </div>
                      {char.speakingStyle && (
                        <span className="max-w-[10rem] truncate rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-500">{char.speakingStyle}</span>
                      )}
                    </div>
                    {(char.personality || char.background || char.firstMeeting) && (
                      <div className="mt-3 space-y-2 text-sm text-gray-600 break-words">
                        {char.personality && <p><span className="font-medium text-gray-700">性格：</span>{char.personality}</p>}
                        {char.background && <p><span className="font-medium text-gray-700">背景：</span>{char.background}</p>}
                        {char.firstMeeting && <p><span className="font-medium text-gray-700">初见台词：</span>{char.firstMeeting}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-400">还没添加角色</p>
            )}
          </div>

          {/* Opening Preview */}
          {form.opening && (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">开场白预览</h3>
              <div className="rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-600 whitespace-pre-wrap">
                {form.opening}
              </div>
            </div>
          )}

          <div className={`rounded-2xl border px-4 py-4 text-sm ${publishReady ? 'border-emerald-200 bg-emerald-50/80' : 'border-amber-200 bg-amber-50/80'}`}>
            <p className={`font-semibold ${publishReady ? 'text-emerald-700' : 'text-amber-800'}`}>
              {publishReady ? '发布检查已通过，可以发布到当前内测区' : `发布前还差 ${publishIssueEntries.length} 项`}
            </p>
            {publishReady ? (
              <p className="mt-1 text-xs leading-5 text-emerald-700/80">
                世界名称、题材、叙事模式、世界观、开场和角色都已准备好；发布后会进入当前内测公开区，后续能力再逐步补齐。
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-xs leading-5 text-amber-900/80">
                {publishIssueEntries.map((entry) => (
                  <li key={entry.key} className="flex gap-2">
                    <span className="mt-0.5">•</span>
                    <span>
                      <span className="font-medium">{entry.label}</span>：{entry.message}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Publish Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleSubmit('draft')}
              disabled={submitting}
              className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-600 transition-all hover:border-brand hover:text-brand cursor-pointer disabled:opacity-50"
            >
              {submitting ? '保存中...' : '保存草稿'}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('published')}
              disabled={submitting}
              className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:bg-brand-dark cursor-pointer disabled:opacity-50"
            >
              {submitting ? '发布中...' : '发布到工坊内测'}
            </button>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        {step > 0 ? (
          <button
            type="button"
            onClick={prevStep}
            className="rounded-lg border border-gray-200 px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            上一步
          </button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 && (
          <button
            type="button"
            onClick={nextStep}
            className="rounded-lg bg-brand px-6 py-2 text-sm font-semibold text-white hover:bg-brand-dark transition-colors cursor-pointer"
          >
            下一步
          </button>
        )}
      </div>

    </div>
  );
}
