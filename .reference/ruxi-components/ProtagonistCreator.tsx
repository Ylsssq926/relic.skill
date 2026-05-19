'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { SITE_CONFIG } from '@/config/site';
import { trapFocus } from '@/lib/a11y';
import { getTextLength, truncateText } from '@/lib/utils';
import { toast } from '@/lib/toast';

interface PlayableCharacter {
  id: string | number;
  name: string;
  personality?: string;
  background?: string;
  appearance?: string;
}

interface ProtagonistCreatorProps {
  worldGenre: string;
  playType?: string;
  playableCharacters?: PlayableCharacter[];
  interactionTargetLabel?: string;
  initialCharacterId?: string | number;
  defaultName?: string;
  onConfirm: (name: string, description: string, characterId?: string | number) => void | Promise<void>;
  onClose: () => void;
}

interface EntryGuide {
  badge: string;
  cards: { title: string; description: string }[];
}

const PLAY_LIMITS = SITE_CONFIG.limits.play;

const PRESETS: Record<string, { label: string; name: string; desc: string }[]> = {
  wuxia: [
    { label: '落魄少年', name: '林逸', desc: '出身贫寒的少年，天赋平平却有一颗不屈之心。自幼在市井中摸爬滚打，练就了一身察言观色的本事。' },
    { label: '世家子弟', name: '萧云', desc: '名门望族的嫡系子弟，自幼修习家传武学。看似风光无限，实则暗流涌动，家族内斗不断。' },
    { label: '江湖游侠', name: '楚风', desc: '行走江湖多年的独行侠，剑术精湛，性格洒脱。不拘小节，却有自己的底线和原则。' },
    { label: '隐世高手', name: '苏默', desc: '隐居山林的神秘人物，身怀绝技却不问世事。一场意外打破了平静的生活，不得不重入江湖。' },
  ],
  xianxia: [
    { label: '散修弟子', name: '叶尘', desc: '无门无派的散修，靠着一股韧劲在修仙界艰难求存。' },
    { label: '宗门天才', name: '凌霄', desc: '天灵根资质，宗门重点培养的天才弟子。' },
    { label: '落魄仙人', name: '沧溟', desc: '曾经的仙界大能，因故跌落凡间，记忆残缺。' },
    { label: '妖族后裔', name: '白九', desc: '人妖混血，在两族之间艰难求存。' },
  ],
};

const RELATIONSHIP_PRESETS = [
  { label: '慢热熟人', name: '林晚', desc: '和对方早就认识，表面若即若离，心里却一直把这段关系看得很重。' },
  { label: '新来的那个人', name: '周屿', desc: '刚闯进对方生活，礼貌克制，心里却藏着想靠近的冲动。' },
  { label: '带着心事的人', name: '许栀', desc: '外表平静，内心敏感，习惯先观察别人，再一点点把真心交出去。' },
  { label: '嘴硬心软', name: '阿宁', desc: '看起来很会顶嘴，其实比谁都在意对方的情绪，越熟越会露出真心。' },
];

const ROLEPLAY_PRESETS = [
  { label: '平行世界版', name: '云逸', desc: '保留原角色的核心气质，但会按照你自己的选择方式做出不同决定。' },
  { label: '失忆重开版', name: '墨白', desc: '带着熟悉身份进入剧情，却对过去只剩模糊印象，需要重新找回自我。' },
  { label: '黑化分支版', name: '夜澜', desc: '仍是那个角色，却更锋利、更克制，也更容易走向截然不同的分支。' },
  { label: '温柔反差版', name: '清欢', desc: '外表依旧熟悉，但内里更柔和，适合走一条和原作不太一样的关系线。' },
];

const DEFAULT_PRESETS = [
  { label: '普通人', name: '张三', desc: '一个普通人，被卷入了不普通的事件中。' },
  { label: '天才少年', name: '李明', desc: '天赋异禀的少年，注定不平凡的命运。' },
  { label: '神秘旅人', name: '无名', desc: '来历不明的旅人，似乎隐藏着不为人知的秘密。' },
  { label: '落魄贵族', name: '沈逸', desc: '家道中落的贵族后裔，试图重振家业。' },
];

const RANDOM_NAMES = ['云逸', '墨白', '星辰', '风吟', '夜澜', '清欢', '长安', '归尘', '惊鸿', '浮生'];
const RANDOM_DESCS = [
  '性格沉稳，不善言辞，但内心炽热。擅长观察，总能在关键时刻做出正确判断。',
  '天性乐观，嘴上功夫一流。看似吊儿郎当，实则心思缜密。',
  '冷静理性，做事有条不紊。不轻易相信他人，但一旦认定便全力以赴。',
  '热血冲动，重情重义。虽然经常惹麻烦，但总能化险为夷。',
];

const RELATIONSHIP_RANDOM_NAMES = ['阿宁', '周屿', '林晚', '许栀', '小满', '程野'];
const RELATIONSHIP_RANDOM_DESCS = [
  '习惯先观察气氛，再慢慢靠近真正想亲近的人。',
  '看上去很稳，其实很容易被真诚打动，越熟越会露出柔软的一面。',
  '嘴上有点倔，却很会记住别人随口提过的小事。',
  '不擅长主动表达，但会用行动把在意藏进相处的细节里。',
];

const ROLEPLAY_RANDOM_NAMES = ['云逸', '墨白', '星辰', '风吟', '惊鸿', '长安'];
const ROLEPLAY_RANDOM_DESCS = [
  '保留熟悉身份，但会按照你自己的判断和情绪去演绎这个角色。',
  '像是平行世界版本，气质相近，选择方式却会走向不同分支。',
  '外在克制，内心有自己的一套坚持，适合演出反差感。',
  '带着一点神秘和距离感，但真正熟起来后会有完全不同的一面。',
];

const QUICK_START_NAMES = ['旅人', '冒险者', '无名侠客', '过客', '行者'];
const RELATIONSHIP_QUICK_START_NAMES = ['阿宁', '周屿', '林晚', '许栀', '小满'];
const ROLEPLAY_QUICK_START_NAMES = ['云逸', '墨白', '星辰', '风吟', '惊鸿'];

function getEntryGuide(
  playType: string | undefined,
  interactionTargetLabel: string,
  isRolePlayWithCharacters: boolean,
  playableCharacterCount: number,
): EntryGuide {
  if (playType === 'role_play') {
    return {
      badge: '🎭 先挑身份',
      cards: [
        {
          title: '你先会撞上谁',
          description: interactionTargetLabel
            ? `多半会先和 ${interactionTargetLabel} 对上戏。`
            : '多半会先和关键角色对上戏。',
        },
        {
          title: '你怎么进场',
          description: isRolePlayWithCharacters
            ? `先挑一个要代入的角色${playableCharacterCount > 1 ? '。挑好就能上场。' : '，直接进去。'}`
            : '先定好你要演谁，再进去。',
        },
        {
          title: '这条线更像什么',
          description: '偏代入、对戏、改写。',
        },
      ],
    };
  }

  if (playType === 'romance') {
    return {
      badge: '💕 先认认人',
      cards: [
        {
          title: '你先会撞上谁',
          description: interactionTargetLabel
            ? `开口多半先是 ${interactionTargetLabel}。`
            : '开口多半先是主互动角色。',
        },
        {
          title: '你怎么进场',
          description: interactionTargetLabel
            ? `带着你的名字去见 ${interactionTargetLabel} 就行。`
            : '带着你的名字进去就行。',
        },
        {
          title: '这条线更像什么',
          description: '偏心动、拉扯、慢慢靠近。',
        },
      ],
    };
  }

  if (playType === 'companion') {
    return {
      badge: '🤝 先认认人',
      cards: [
        {
          title: '你先会撞上谁',
          description: interactionTargetLabel
            ? `多半先和 ${interactionTargetLabel} 说上话。`
            : '多半先和主互动角色说上话。',
        },
        {
          title: '你怎么进场',
          description: interactionTargetLabel
            ? `带着你的名字去见 ${interactionTargetLabel} 就行。`
            : '带着你的名字进去就行。',
        },
        {
          title: '这条线更像什么',
          description: '偏陪伴、治愈、慢慢熟。',
        },
      ],
    };
  }

  return {
    badge: '🌍 先起个名字',
    cards: [
      {
        title: '你先会撞上谁',
        description: interactionTargetLabel
          ? `进去后，很快会遇见 ${interactionTargetLabel}。`
          : '进去后，很快会遇见关键角色。',
      },
      {
        title: '你怎么进场',
        description: '带着你的名字进去，别的可以边走边长。',
      },
      {
        title: '这条线更像什么',
        description: '偏开局、探索、往前推。',
      },
    ],
  };
}

export function ProtagonistCreator({
  worldGenre,
  playType,
  playableCharacters,
  interactionTargetLabel,
  initialCharacterId,
  defaultName,
  onConfirm,
  onClose,
}: ProtagonistCreatorProps) {
  const playableCharacterList = useMemo(() => playableCharacters ?? [], [playableCharacters]);
  const isRolePlay = playType === 'role_play';
  const isCompanionPlay = playType === 'companion';
  const isRomancePlay = playType === 'romance';
  const isRelationshipPlay = isRomancePlay || isCompanionPlay;
  const isRolePlayWithCharacters = isRolePlay && playableCharacterList.length > 0;
  const normalizedTargetLabel = interactionTargetLabel?.trim() || '';
  const clampProtagonistName = (value: string) => truncateText(value, PLAY_LIMITS.protagonistNameMaxLength);
  const clampProtagonistDescription = (value: string) => truncateText(value, PLAY_LIMITS.protagonistDescMaxLength);
  const normalizedDefaultName = clampProtagonistName(defaultName?.trim() || '');
  const autoSelectedCharacter = isRolePlayWithCharacters && playableCharacterList.length === 1 ? playableCharacterList[0] : undefined;
  const initialSelectedCharacter = isRolePlayWithCharacters && initialCharacterId != null
    ? playableCharacterList.find((char) => String(char.id) === String(initialCharacterId))
    : autoSelectedCharacter;
  const initialCharacterDescription = '';
  const initialCustomName = clampProtagonistName(initialSelectedCharacter?.name || normalizedDefaultName || '');

  const [mode, setMode] = useState<'select' | 'custom'>(isRolePlayWithCharacters ? 'select' : 'custom');
  const [name, setName] = useState(initialCustomName);
  const [description, setDescription] = useState(initialCharacterDescription);
  const [confirming, setConfirming] = useState(false);
  const [quickStarting, setQuickStarting] = useState(false);
  const [selectedCharId, setSelectedCharId] = useState<string | number | null>(initialSelectedCharacter?.id ?? null);
  const isSubmittingEntry = confirming || quickStarting;
  const [showCustomOptionalSection, setShowCustomOptionalSection] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const selectedCharacterButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);
  const initialModeRef = useRef(mode);

  const presets = isRelationshipPlay
    ? RELATIONSHIP_PRESETS
    : isRolePlay
      ? ROLEPLAY_PRESETS
      : PRESETS[worldGenre] || DEFAULT_PRESETS;
  const randomNames = isRelationshipPlay
    ? RELATIONSHIP_RANDOM_NAMES
    : isRolePlay
      ? ROLEPLAY_RANDOM_NAMES
      : RANDOM_NAMES;
  const randomDescs = isRelationshipPlay
    ? RELATIONSHIP_RANDOM_DESCS
    : isRolePlay
      ? ROLEPLAY_RANDOM_DESCS
      : RANDOM_DESCS;
  const quickStartNames = isRelationshipPlay
    ? RELATIONSHIP_QUICK_START_NAMES
    : isRolePlay
      ? ROLEPLAY_QUICK_START_NAMES
      : QUICK_START_NAMES;
  const trimmedNameLength = getTextLength(name.trim());
  const canConfirm = mode === 'select'
    ? Boolean(selectedCharId)
    : trimmedNameLength >= PLAY_LIMITS.protagonistNameMinLength;
  const selectedCharacter = useMemo(
    () => (selectedCharId != null ? playableCharacterList.find((char) => String(char.id) === String(selectedCharId)) : undefined),
    [playableCharacterList, selectedCharId],
  );
  const entryGuide = getEntryGuide(playType, normalizedTargetLabel, isRolePlayWithCharacters, playableCharacterList.length);
  const entryGuideCards = entryGuide.cards.slice(0, 2);
  const entryPreviewCue = mode === 'select'
    ? selectedCharacter
      ? normalizedTargetLabel
        ? `进去后，你会直接用 ${selectedCharacter.name} 去见 ${normalizedTargetLabel}。`
        : `进去后，你会直接用 ${selectedCharacter.name} 开口。`
      : (normalizedTargetLabel ? `挑中一个角色后，就会直接去见 ${normalizedTargetLabel}。` : '挑中一个角色后，就能直接进场。')
    : name.trim()
      ? normalizedTargetLabel
        ? `进去后，对方会先认出「${name.trim()}」。`
        : `进去后，故事会先记住「${name.trim()}」。`
      : isCompanionPlay
        ? '先给自己一个称呼。'
        : isRelationshipPlay
          ? '先给自己一个名字。'
          : isRolePlay
            ? '先给这一版的你起个名字。'
            : '先给主角起个名字。';
  const entryPreviewBadge = mode === 'select'
    ? selectedCharacter
      ? `就用 ${selectedCharacter.name}`
      : '先挑一个角色'
    : name.trim()
      ? `就叫「${name.trim()}」`
      : '就差一个名字';

  const handleRandom = () => {
    setName(clampProtagonistName(randomNames[Math.floor(Math.random() * randomNames.length)]));
    setDescription(clampProtagonistDescription(randomDescs[Math.floor(Math.random() * randomDescs.length)]));
    setShowCustomOptionalSection(true);
  };

  const handlePreset = (preset: { name: string; desc: string }) => {
    setName(clampProtagonistName(preset.name));
    setDescription(clampProtagonistDescription(preset.desc));
    setShowCustomOptionalSection(true);
  };

  const handleSelectCharacter = (char: PlayableCharacter) => {
    setSelectedCharId(char.id);
    setName(clampProtagonistName(char.name));
  };

  const handleQuickStart = async () => {
    if (quickStarting || confirming) return;
    setQuickStarting(true);
    const quickStartName = clampProtagonistName(normalizedDefaultName || quickStartNames[Math.floor(Math.random() * quickStartNames.length)]);
    const quickStartToast = isCompanionPlay
      ? normalizedTargetLabel
        ? `先用「${quickStartName}」去见 ${normalizedTargetLabel}`
        : `先用「${quickStartName}」进场`
      : isRelationshipPlay
        ? normalizedTargetLabel
          ? `先用「${quickStartName}」去见 ${normalizedTargetLabel}`
          : `先用「${quickStartName}」进场`
        : isRolePlay
          ? `先用「${quickStartName}」进场`
          : `先用「${quickStartName}」进场`;

    toast.info(quickStartToast);
    try {
      await onConfirm(quickStartName, '');
    } finally {
      setQuickStarting(false);
    }
  };

  const handleRequestClose = useCallback(() => {
    if (isSubmittingEntry) return;
    onClose();
  }, [isSubmittingEntry, onClose]);

  const headerTitle = isRolePlayWithCharacters
    ? '这次借谁进场'
    : isCompanionPlay
      ? normalizedTargetLabel
        ? `你想让 ${normalizedTargetLabel} 怎么叫你？`
        : '先给自己一个称呼'
      : isRelationshipPlay
        ? normalizedTargetLabel
          ? `你要怎么去见 ${normalizedTargetLabel}？`
          : '先定个你要用的名字'
        : '准备怎么进场';
  const headerDesc = isRolePlayWithCharacters
    ? '挑一个现成角色，或者自己来。'
    : isCompanionPlay
      ? normalizedTargetLabel
        ? `先给 ${normalizedTargetLabel} 一个能叫出口的名字。${normalizedDefaultName ? ` 直接用「${normalizedDefaultName}」也行。` : ''}`
        : `先给自己一个能叫出口的名字。${normalizedDefaultName ? ` 直接用「${normalizedDefaultName}」也行。` : ''}`
      : isRelationshipPlay
        ? normalizedTargetLabel
          ? `先定个名字，再去见 ${normalizedTargetLabel}。${normalizedDefaultName ? ` 直接用「${normalizedDefaultName}」也行。` : ''}`
          : `先定个名字，再进去。${normalizedDefaultName ? ` 直接用「${normalizedDefaultName}」也行。` : ''}`
        : normalizedDefaultName
          ? `先起个名字就能进。懒得想，就用「${normalizedDefaultName}」。`
          : '先起个名字就能进。';
  const mobileHeaderDesc = isRolePlayWithCharacters
    ? '挑一个，或者自己来。'
    : isCompanionPlay
      ? normalizedTargetLabel
        ? `写个称呼，就能去见 ${normalizedTargetLabel}。`
        : '写个称呼，就能开始。'
      : isRelationshipPlay
        ? normalizedTargetLabel
          ? `写个名字，就能去见 ${normalizedTargetLabel}。`
          : '写个名字，就能开始。'
        : isRolePlay
          ? '起个名字，就能进场。'
          : '起个名字，就能进场。';
  const entryTip = isRolePlayWithCharacters && mode === 'select'
    ? '想快点，就直接挑一个。'
    : isCompanionPlay
      ? normalizedTargetLabel
        ? `先写个称呼，就能去见 ${normalizedTargetLabel}。`
        : '先写个称呼，就能开始。'
      : isRelationshipPlay
        ? normalizedTargetLabel
          ? `先写个名字，就能去见 ${normalizedTargetLabel}。`
          : '先写个名字，就能开始。'
        : isRolePlay
          ? '先给这一版的你一个名字。'
          : '先起个名字，别的边走边补。';
  const quickStartLabel = isCompanionPlay
    ? normalizedTargetLabel
      ? `${normalizedDefaultName ? `直接用「${normalizedDefaultName}」去见 ${normalizedTargetLabel}` : `先起个称呼去见 ${normalizedTargetLabel}`}`
      : `${normalizedDefaultName ? `直接用「${normalizedDefaultName}」开始` : '先起个称呼开始'}`
    : isRelationshipPlay
      ? normalizedTargetLabel
        ? `${normalizedDefaultName ? `直接用「${normalizedDefaultName}」去见 ${normalizedTargetLabel}` : `先起个名字去见 ${normalizedTargetLabel}`}`
        : `${normalizedDefaultName ? `直接用「${normalizedDefaultName}」开始` : '先起个名字开始'}`
      : isRolePlay
        ? `${normalizedDefaultName ? `直接用「${normalizedDefaultName}」进场` : '先起个名字进场'}`
        : `${normalizedDefaultName ? `直接用「${normalizedDefaultName}」开始` : '一键进场'}`;
  const nameLabel = isCompanionPlay
    ? 'TA 会怎么叫你'
    : isRelationshipPlay
      ? '你想被怎么叫'
      : isRolePlay
        ? '这一版你叫什么'
        : '戏里怎么叫你';
  const namePlaceholder = isCompanionPlay
    ? '例如：阿宁 / 小满 / 你的常用名字'
    : isRelationshipPlay
      ? '例如：阿宁 / 周屿 / 你的常用名字'
      : isRolePlay
        ? '例如：平行世界的沈砚 / 失忆后的你'
        : '例如：阿宁 / 沈砚 / 旅人';
  const nameHelper = isCompanionPlay
    ? '先有个称呼就够了。'
    : isRelationshipPlay
      ? '先有个名字就够了。'
      : isRolePlay
        ? '先起个名字，后面边演边找。'
        : '先起个名字，别的不用急。';
  const descriptionLabel = isCompanionPlay
    ? '想先被记住哪一点'
    : isRelationshipPlay
      ? '你想先递哪一点'
      : isRolePlay
        ? '这一版先露哪一面'
        : '再添一点味道';
  const descriptionPlaceholder = isCompanionPlay
    ? '一句话就够：慢热，但很认真。留空也能开始。'
    : isRelationshipPlay
      ? '一句话就够：嘴硬心软，先看后说。留空也能开始。'
      : isRolePlay
        ? '一句话说说这版的感觉，比如：表面冷，熟了才软。'
        : '一句话就够：冷静，擅长观察。留空也能开始。';
  const descriptionHelper = isCompanionPlay
    ? '留空也能进，后面聊着聊着就会长出来。'
    : isRelationshipPlay
      ? '留空也能进，关系会在对话里自己热起来。'
      : isRolePlay
        ? '先别定太死，边演边找也很好。'
        : '不想写就先空着。';
  const presetsTitle = '不想空着写？拿一个先用';
  const randomLabel = '🎲 换一组';
  const selectModeHint = normalizedTargetLabel
    ? `挑中谁，就用谁去见 ${normalizedTargetLabel}。`
    : '挑中谁，就用谁进场。';
  const confirmLabel = mode === 'select' && selectedCharId
    ? `就用「${name}」`
    : normalizedTargetLabel
      ? `去见 ${normalizedTargetLabel}`
      : '进场';
  const currentEntrySummary = mode === 'select'
    ? selectedCharacter
      ? normalizedTargetLabel
        ? `你会直接用「${selectedCharacter.name}」去见 ${normalizedTargetLabel}。`
        : `你会直接用「${selectedCharacter.name}」进场。`
      : '挑一个角色，这里就会告诉你怎么进。'
    : name.trim()
      ? normalizedTargetLabel
        ? `你会用「${name.trim()}」去见 ${normalizedTargetLabel}。`
        : `你会用「${name.trim()}」进场。`
      : isCompanionPlay
        ? '先写个称呼，就能开始。'
        : isRelationshipPlay
          ? '先写个名字，就能开始。'
          : isRolePlay
            ? '先给这一版的你起个名字。'
            : '先给主角起个名字。';
  const quickSelectLabel = selectedCharacter
    ? normalizedTargetLabel
      ? `就用「${selectedCharacter.name}」去见 ${normalizedTargetLabel}`
      : `就用「${selectedCharacter.name}」进场`
    : '先挑一个';
  const entryPreviewTitle = mode === 'select'
    ? selectedCharacter
      ? `就用「${selectedCharacter.name}」进场`
      : isRolePlayWithCharacters
        ? '先挑一个角色'
        : '先挑一个你要用的身份'
    : name.trim()
      ? `就叫「${name.trim()}」`
      : isCompanionPlay
        ? '先起个称呼'
        : '先起个名字';
  const entryPreviewText = mode === 'select'
    ? selectedCharacter
      ? currentEntrySummary
      : selectModeHint
    : description.trim()
      ? description.trim()
      : currentEntrySummary;

  useEffect(() => {
    previousFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      if (initialModeRef.current === 'custom') {
        nameInputRef.current?.focus();
        return;
      }

      selectedCharacterButtonRef.current?.focus();
      if (document.activeElement === document.body) {
        closeButtonRef.current?.focus();
      }
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isSubmittingEntry) return;
        event.preventDefault();
        handleRequestClose();
        return;
      }

      trapFocus(dialogRef.current, event);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusedElementRef.current?.focus();
    };
  }, [handleRequestClose, isSubmittingEntry]);

  useEffect(() => {
    if (mode === 'custom') {
      window.requestAnimationFrame(() => nameInputRef.current?.focus());
      return;
    }

    window.requestAnimationFrame(() => selectedCharacterButtonRef.current?.focus());
  }, [mode, selectedCharId]);

  const handleConfirmCurrentEntry = async () => {
    if (!canConfirm || confirming || quickStarting) return;
    setConfirming(true);
    try {
      const characterId = mode === 'select' ? selectedCharId ?? undefined : undefined;
      await onConfirm(
        clampProtagonistName(name.trim()),
        mode === 'select' ? '' : clampProtagonistDescription(description.trim()),
        characterId,
      );
    } finally {
      setConfirming(false);
    }
  };

  return (
    <AnimatePresence>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm sm:items-center sm:justify-center"
        onClick={(e) => e.target === e.currentTarget && handleRequestClose()}
      >
        <m.div
          ref={dialogRef}
          initial={{ opacity: 0, scale: 0.98, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="protagonist-creator-title"
          aria-describedby="protagonist-creator-desc"
          aria-busy={isSubmittingEntry}
          tabIndex={-1}
          className="mt-auto flex h-[92dvh] max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[30px] bg-white shadow-2xl sm:mx-auto sm:my-4 sm:h-auto sm:max-h-[86vh] sm:max-w-[40rem] sm:rounded-[2rem]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-brand-dark via-brand to-brand-light px-4 pb-4 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6 sm:py-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.18),transparent_34%)]" />
            <div className="mb-3 flex justify-center sm:hidden">
              <div className="h-1 w-10 rounded-full bg-white/40" />
            </div>
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <h2 id="protagonist-creator-title" className="text-xl font-bold text-white sm:text-2xl">{headerTitle}</h2>
                <p id="protagonist-creator-desc" className="mt-1 text-xs leading-5 text-white/85 sm:hidden">{mobileHeaderDesc}</p>
                <p className="mt-1 hidden text-sm leading-6 text-white/85 sm:block">{headerDesc}</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={handleRequestClose}
                disabled={isSubmittingEntry}
                className="rounded-2xl border border-white/15 bg-white/10 p-2.5 text-white/90 transition-colors hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={isSubmittingEntry ? '正在进入故事，暂时无法关闭' : '关闭主角创建弹层'}
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-28 sm:px-6 sm:py-5 sm:pb-5">
            <div className="overflow-hidden rounded-[24px] bg-gradient-to-br from-slate-950 via-slate-900 to-brand-dark px-4 py-4 text-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.78)] sm:rounded-[28px] sm:px-5 sm:py-5">
              <p className="text-xs font-semibold tracking-[0.22em] text-white/72">先定一下这次怎么进</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold leading-8 text-white">{entryPreviewTitle}</p>
                <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/82">{entryPreviewBadge}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-white/82">{entryPreviewText}</p>
              <p className="mt-2 text-xs leading-5 text-white/68">{entryPreviewCue}</p>
              <p className="mt-3 inline-flex rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/78">
                进去以后，主要靠你自己接话；到岔口时，才会给你几个选项。
              </p>
            </div>

            <div className="space-y-3">
              <div className="inline-flex rounded-full border border-brand/10 bg-brand/5 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-brand/70">
                {entryGuide.badge}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {entryGuideCards.map((card) => (
                  <div key={card.title} className="rounded-[22px] border border-gray-100 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-semibold text-gray-900">{card.title}</p>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{card.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {isSubmittingEntry && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                正在送你进场，等一下。
              </div>
            )}

            {isRolePlayWithCharacters && (
              <>
                <div className="flex rounded-2xl bg-gray-100 p-1">
                  <button
                    type="button"
                    aria-pressed={mode === 'select'}
                    disabled={isSubmittingEntry}
                    onClick={() => {
                      setMode('select');
                      if (selectedCharacter) {
                        handleSelectCharacter(selectedCharacter);
                      }
                    }}
                    className={`flex min-h-[48px] flex-1 items-center justify-center rounded-xl px-3 text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                      mode === 'select' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    借 TA 进
                  </button>
                  <button
                    type="button"
                    aria-pressed={mode === 'custom'}
                    disabled={isSubmittingEntry}
                    onClick={() => setMode('custom')}
                    className={`flex min-h-[48px] flex-1 items-center justify-center rounded-xl px-3 text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                      mode === 'custom' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    自己来
                  </button>
                </div>

                {mode === 'select' && (
                  <div className="space-y-3">
                    {selectedCharacter && (
                      <p className="text-xs leading-5 text-gray-500">{quickSelectLabel}</p>
                    )}
                    {playableCharacterList.map((char, index) => (
                      <button
                        key={char.id}
                        ref={selectedCharId === char.id || (selectedCharId == null && index === 0) ? selectedCharacterButtonRef : undefined}
                        type="button"
                        aria-pressed={selectedCharId === char.id}
                        disabled={isSubmittingEntry}
                        onClick={() => handleSelectCharacter(char)}
                        className={`w-full rounded-2xl border-2 p-4 text-left transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                          selectedCharId === char.id
                            ? 'border-brand bg-brand/5 shadow-sm'
                            : 'border-gray-200 hover:border-brand/50 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand/20 to-brand-light/20 text-sm font-bold text-brand">
                            {char.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-gray-800">{char.name}</p>
                              {playableCharacterList.length === 1 && (
                                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
                                  已为你预选
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                              {char.personality || char.background || '暂无描述'}
                            </p>
                          </div>
                          {selectedCharId === char.id && (
                            <svg className="h-5 w-5 shrink-0 text-brand" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {mode === 'custom' && (
              <>
                <div className="rounded-[24px] border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold tracking-[0.18em] text-brand/70">先起个名字</p>
                      <p className="mt-2 text-sm leading-6 text-gray-600">{entryPreviewCue}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleQuickStart}
                      disabled={isSubmittingEntry}
                      title={quickStartLabel}
                      aria-label={quickStartLabel}
                      className="shrink-0 rounded-full border border-brand/15 bg-brand/5 px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {quickStarting ? '进场中…' : '一键进场'}
                    </button>
                  </div>
                  <input
                    ref={nameInputRef}
                    id="protagonist-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(clampProtagonistName(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing && mode === 'custom' && canConfirm && !confirming && !quickStarting) {
                        e.preventDefault();
                        void handleConfirmCurrentEntry();
                      }
                    }}
                    placeholder={namePlaceholder}
                    disabled={isSubmittingEntry}
                    className="mt-4 w-full rounded-[22px] border border-gray-200 px-4 py-3.5 text-base text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 sm:text-[17px]"
                  />
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500">
                    <span>{nameLabel}</span>
                    <span>{getTextLength(name)}/{PLAY_LIMITS.protagonistNameMaxLength}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-gray-500">{nameHelper}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCustomOptionalSection((prev) => !prev)}
                  disabled={isSubmittingEntry}
                  className="flex min-h-[48px] w-full items-center justify-between rounded-[22px] border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>{showCustomOptionalSection ? '先收起来（选填）' : '再添一点味道（选填）'}</span>
                  <span aria-hidden="true">{showCustomOptionalSection ? '−' : '+'}</span>
                </button>

                {showCustomOptionalSection && (
                  <div className="rounded-[24px] border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{presetsTitle}</p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">{descriptionHelper}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {presets.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          disabled={isSubmittingEntry}
                          onClick={() => handlePreset(preset)}
                          className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-all hover:border-brand hover:bg-brand-50 hover:text-brand cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <label htmlFor="protagonist-desc" className="mt-4 block text-xs font-semibold tracking-[0.16em] text-gray-500">
                      {descriptionLabel}
                    </label>
                    <textarea
                      id="protagonist-desc"
                      value={description}
                      onChange={(e) => {
                        setDescription(clampProtagonistDescription(e.target.value));
                        if (e.target.value.trim()) setShowCustomOptionalSection(true);
                      }}
                      placeholder={descriptionPlaceholder}
                      rows={3}
                      disabled={isSubmittingEntry}
                      className="mt-4 w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                      <button
                        type="button"
                        onClick={handleRandom}
                        disabled={isSubmittingEntry}
                        className="rounded-full border border-dashed border-gray-200 px-3 py-1.5 text-gray-500 transition-all hover:border-brand hover:text-brand cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {randomLabel}
                      </button>
                      <span>{getTextLength(description)}/{PLAY_LIMITS.protagonistDescMaxLength}</span>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>

          <div className="shrink-0 border-t border-gray-100 bg-gray-50/92 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-6">
            {isSubmittingEntry ? (
              <p className="mb-3 text-center text-xs leading-5 text-gray-500">正在送你进场，等一下。</p>
            ) : (
              <p className="mb-3 text-center text-xs leading-5 text-gray-500">{entryTip}</p>
            )}
            <button
              type="button"
              onClick={handleConfirmCurrentEntry}
              disabled={!canConfirm || confirming || quickStarting}
              className={`min-h-[54px] w-full rounded-2xl px-4 py-3 text-base font-semibold transition-all ${
                canConfirm && !confirming && !quickStarting
                  ? 'bg-brand text-white shadow-lg shadow-brand/25 hover:bg-brand-dark cursor-pointer'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400'
              }`}
            >
              {confirming ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  进场中...
                </span>
              ) : confirmLabel}
            </button>
          </div>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}
