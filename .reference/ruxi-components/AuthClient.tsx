'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { SITE_CONFIG } from '@/config/site';
import { useAuth } from '@/lib/auth-context';
import { authAPI } from '@/lib/api';
import { getTextLength, truncateText } from '@/lib/utils';
import { toast } from '@/lib/toast';

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeNickname = (nickname: string) => nickname.trim();
const getSafeRedirect = (redirect: string | null) => {
  if (!redirect) return '/';
  const normalized = redirect.trim();
  if (!normalized.startsWith('/') || normalized.startsWith('//')) return '/';
  return normalized;
};
const isSafeAction = (action: string | null): action is 'start' | 'report' => action === 'start' || action === 'report';
const getRedirectQueryParams = (redirect: string) => {
  const queryStart = redirect.indexOf('?');
  return new URLSearchParams(queryStart < 0 ? '' : redirect.slice(queryStart + 1));
};
const getActionFromRedirect = (redirect: string) => {
  const action = getRedirectQueryParams(redirect).get('action');
  return isSafeAction(action) ? action : null;
};
const getSourceFromRedirect = (redirect: string) => getRedirectQueryParams(redirect).get('from');

const AUTH_LIMITS = SITE_CONFIG.limits.auth;
const NICKNAME_INPUT_MAX_LENGTH = AUTH_LIMITS.nicknameMaxLength * 2;
const VERIFICATION_CODE_PATTERN = new RegExp(`^\\d{${AUTH_LIMITS.verificationCodeLength}}$`);
const QUICK_NICKNAME_PREFIXES = ['阿', '小', '星', '云', '晚', '雾'];
const QUICK_NICKNAME_SUFFIXES = ['宁', '栀', '岚', '序', '禾', '鹿'];
type AuthTab = 'login' | 'register' | 'reset';

interface AuthClientProps {
  redirect?: string | null;
  action?: string | null;
}

function createQuickNickname(email: string) {
  const localPart = normalizeEmail(email).split('@')[0]?.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '') || '';
  const normalizedLocalPart = truncateText(localPart, AUTH_LIMITS.nicknameMaxLength).trim();

  if (normalizedLocalPart.length >= AUTH_LIMITS.nicknameMinLength) {
    return normalizedLocalPart;
  }

  const prefix = QUICK_NICKNAME_PREFIXES[Math.floor(Math.random() * QUICK_NICKNAME_PREFIXES.length)];
  const suffix = QUICK_NICKNAME_SUFFIXES[Math.floor(Math.random() * QUICK_NICKNAME_SUFFIXES.length)];
  return truncateText(`${prefix}${suffix}`, AUTH_LIMITS.nicknameMaxLength);
}

function AuthContent({ redirect, action }: AuthClientProps) {
  const router = useRouter();
  const redirectTo = getSafeRedirect(redirect ?? null);
  const actionParam = action ?? null;
  const safeAction = isSafeAction(actionParam) ? actionParam : null;
  const redirectAction = getActionFromRedirect(redirectTo);
  const restoredAction = safeAction ?? redirectAction;
  const cameFromWorldStart = restoredAction === 'start' && redirectTo.startsWith('/world/');
  const cameFromReport = restoredAction === 'report';
  const cameFromSharedStory = cameFromWorldStart && getSourceFromRedirect(redirectTo) === 'share';
  const compactContextHint = redirectTo !== '/'
    ? cameFromWorldStart
      ? '弄好就回刚才那个世界。'
      : cameFromReport
        ? '弄好就回刚才那页。'
        : '弄好就回刚才那页。'
    : '';
  const loginButtonLabel = cameFromWorldStart
    ? '登录后继续'
    : cameFromReport
      ? '登录后返回'
      : '登录';
  const registerButtonLabel = cameFromWorldStart
    ? '注册后继续'
    : cameFromReport
      ? '注册后返回'
      : '注册';
  const loginTabLabel = '登录';
  const registerTabLabel = '注册';
  const resetIntroTitle = '找回密码';
  const resetIntroDescription = '收个验证码，换个新密码。';
  const [tab, setTab] = useState<AuthTab>(() => (cameFromWorldStart ? 'register' : 'login'));
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    email: '',
    nickname: '',
    password: '',
    confirmPassword: '',
    inviteCode: '',
    verificationCode: '',
  });
  const [resetForm, setResetForm] = useState({
    email: '',
    code: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showInviteField, setShowInviteField] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [inlineNotice, setInlineNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [countdowns, setCountdowns] = useState<{ register: number; reset: number }>({ register: 0, reset: 0 });
  const [sendingCodePurpose, setSendingCodePurpose] = useState<'register' | 'reset' | null>(null);
  const isSendingRegisterCode = sendingCodePurpose === 'register';
  const isSendingResetCode = sendingCodePurpose === 'reset';
  const isBusy = submitting || sendingCodePurpose !== null;
  const loginTabRef = useRef<HTMLButtonElement>(null);
  const registerTabRef = useRef<HTMLButtonElement>(null);
  // 构建登录后的跳转 URL，保留 action 参数
  const redirectWithAction = safeAction && !redirectAction
    ? `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}action=${safeAction}`
    : redirectTo;
  const { login, register, user, loading: authLoading } = useAuth();

  // If already logged in, redirect
  useEffect(() => {
    if (user) router.replace(redirectWithAction);
  }, [user, router, redirectWithAction]);

  useEffect(() => {
    setTab(cameFromWorldStart ? 'register' : 'login');
  }, [cameFromWorldStart]);

  useEffect(() => {
    if (registerForm.inviteCode.trim()) setShowInviteField(true);
  }, [registerForm.inviteCode]);

  // 验证码倒计时
  useEffect(() => {
    if (countdowns.register <= 0 && countdowns.reset <= 0) return;
    const timer = setTimeout(() => {
      setCountdowns((prev) => ({
        register: Math.max(0, prev.register - 1),
        reset: Math.max(0, prev.reset - 1),
      }));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdowns.register, countdowns.reset]);

  const suggestNicknameIfBlank = useCallback((email: string) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return;

    setRegisterForm((prev) => {
      if (normalizeNickname(prev.nickname)) return prev;
      return { ...prev, nickname: createQuickNickname(normalizedEmail) };
    });
    setErrors((prev) => {
      if (!prev.nickname) return prev;
      const next = { ...prev };
      delete next.nickname;
      return next;
    });
  }, []);

  const handleSendCode = useCallback(async (purpose: 'register' | 'reset') => {
    if (sendingCodePurpose || countdowns[purpose] > 0) return;

    const sourceEmail = purpose === 'reset' ? resetForm.email : registerForm.email;
    const email = normalizeEmail(sourceEmail);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors(prev => ({ ...prev, email: '请输入有效的邮箱地址' }));
      return;
    }

    setSendingCodePurpose(purpose);
    try {
      await authAPI.sendCode(email, purpose);
      if (purpose === 'reset') {
        setResetForm((prev) => ({ ...prev, email }));
      } else {
        setRegisterForm((prev) => ({
          ...prev,
          email,
          nickname: normalizeNickname(prev.nickname) || createQuickNickname(email),
        }));
      }
      setCountdowns((prev) => ({
        ...prev,
        [purpose]: SITE_CONFIG.limits.auth.sendCodeCountdownSeconds,
      }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next.email;
        delete next.verificationCode;
        delete next.nickname;
        return next;
      });
      setInlineNotice('');
      toast.success(`验证码已发送到 ${email}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '发送失败';
      const retryAfterMatch = message.match(/(\d+)\s*秒后再试/);
      if (retryAfterMatch) {
        setCountdowns((prev) => ({
          ...prev,
          [purpose]: Number(retryAfterMatch[1]),
        }));
      }
      setErrors(prev => ({ ...prev, email: message }));
      toast.error(message);
    } finally {
      setSendingCodePurpose((current) => (current === purpose ? null : current));
    }
  }, [countdowns, registerForm.email, resetForm.email, sendingCodePurpose]);

  const validateEmailField = (email: string) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return '邮箱不能空着';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return '这个邮箱看起来不太对';
    if (normalized.length > AUTH_LIMITS.emailMaxLength) return `邮箱长度不能超过 ${AUTH_LIMITS.emailMaxLength} 个字符`;
    return '';
  };

  const validatePasswordField = (password: string, emptyMessage = '密码不能空着') => {
    if (!password) return emptyMessage;
    if (password.length < AUTH_LIMITS.passwordMinLength) return `密码至少 ${AUTH_LIMITS.passwordMinLength} 位，再长一点点`;
    if (password.length > AUTH_LIMITS.passwordMaxLength) return `密码不能超过 ${AUTH_LIMITS.passwordMaxLength} 个字符`;
    return '';
  };

  const validatePasswordStrength = (password: string): { level: 0 | 1 | 2 | 3; label: string; color: string } => {
    if (!password) return { level: 0, label: '', color: '' };
    if (password.length < AUTH_LIMITS.passwordMinLength) return { level: 1, label: '太短了', color: 'bg-red-400' };
    if (password.length < AUTH_LIMITS.strongPasswordLength && !/[A-Z]/.test(password) && !/[0-9]/.test(password)) return { level: 1, label: '弱', color: 'bg-red-400' };
    if (password.length >= AUTH_LIMITS.strongPasswordLength && /[A-Z]/.test(password) && /[0-9]/.test(password)) return { level: 3, label: '强', color: 'bg-green-500' };
    return { level: 2, label: '中', color: 'bg-yellow-400' };
  };

  const getFieldInputClass = (hasError: boolean) => `w-full rounded-2xl border px-3.5 py-3.5 text-sm outline-none transition-colors disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 focus:ring-2 sm:px-4 sm:py-3.5 ${
    hasError ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-gray-200 focus:border-brand focus:ring-brand/20'
  }`;
  const formCardClass = 'rounded-[1.6rem] border border-gray-100 bg-white p-4 shadow-[0_14px_32px_-28px_rgba(15,23,42,0.16)] sm:p-5';
  const focusChipClass = 'inline-flex items-center rounded-full border border-white/80 bg-white/92 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm';

  const normalizedRegisterEmail = normalizeEmail(registerForm.email);
  const registerEmailError = validateEmailField(registerForm.email);
  const registerCountdown = countdowns.register;
  const registerVerificationHint = isSendingRegisterCode
    ? `验证码正发往 ${normalizedRegisterEmail || '你的邮箱'}…`
    : registerCountdown > 0 && !registerEmailError
      ? `验证码已发到 ${normalizedRegisterEmail}，${registerCountdown} 秒后再发。`
      : !registerEmailError && normalizedRegisterEmail
        ? `验证码会发到 ${normalizedRegisterEmail}。`
        : '先填邮箱，再拿验证码。';
  const registerNicknameHint = normalizeNickname(registerForm.nickname)
    ? '这是你在入戏里的名字，以后还能改。'
    : normalizedRegisterEmail
      ? '没想好也没关系，我们会先帮你带一个。'
      : '先填邮箱，我们会顺手帮你起个昵称。';
  const registerPasswordStrength = validatePasswordStrength(registerForm.password);
  const registerConfirmPasswordHint = !registerForm.confirmPassword
    ? ''
    : registerForm.password === registerForm.confirmPassword
      ? '对上了，直接注册吧。'
      : '两次还没对上。';
  const normalizedResetEmail = normalizeEmail(resetForm.email);
  const resetEmailError = validateEmailField(resetForm.email);
  const resetCountdown = countdowns.reset;
  const resetVerificationHint = isSendingResetCode
    ? `验证码正发往 ${normalizedResetEmail || '你的邮箱'}…`
    : resetCountdown > 0 && !resetEmailError
      ? `验证码已发到 ${normalizedResetEmail}，${resetCountdown} 秒后再发。`
      : !resetEmailError && normalizedResetEmail
        ? `验证码会发到 ${normalizedResetEmail}。`
        : '先填注册邮箱。';
  const resetConfirmPasswordHint = !resetForm.confirmPassword
    ? ''
    : resetForm.newPassword === resetForm.confirmPassword
      ? '对上了，直接改密码。'
      : '两次还没对上。';

  const isEmailAlreadyRegisteredError = (message: string) => /邮箱.*(已存在|已注册)|already exists|already registered/i.test(message);

  const openTab = (nextTab: AuthTab) => {
    setTab(nextTab);
    setErrors({});
    setInlineNotice('');
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (isBusy) return;

    const order: AuthTab[] = ['login', 'register'];
    const currentTab = tab === 'reset' ? 'login' : tab;
    const currentIndex = order.indexOf(currentTab);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % order.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + order.length) % order.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = order.length - 1;
    else return;

    event.preventDefault();
    const nextTab = order[nextIndex];
    openTab(nextTab);
    if (nextTab === 'login') {
      loginTabRef.current?.focus();
    } else {
      registerTabRef.current?.focus();
    }
  };

  const handleFieldFocusCapture = (event: React.FocusEvent<HTMLElement>) => {
    if (window.innerWidth >= 640) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    window.setTimeout(() => {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 120);
  };

  const validateLogin = () => {
    const e: Record<string, string> = {};
    const emailErr = validateEmailField(loginForm.email);
    if (emailErr) e.email = emailErr;
    if (!loginForm.password) e.password = '密码不能空着';
    else if (loginForm.password.length > AUTH_LIMITS.passwordMaxLength) e.password = `密码不能超过 ${AUTH_LIMITS.passwordMaxLength} 个字符`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateRegister = () => {
    const e: Record<string, string> = {};
    const emailErr = validateEmailField(registerForm.email);
    const normalizedNickname = normalizeNickname(registerForm.nickname);
    if (emailErr) e.email = emailErr;
    const nicknameLength = getTextLength(normalizedNickname);
    if (!normalizedNickname) e.nickname = '起个昵称吧';
    else if (nicknameLength < AUTH_LIMITS.nicknameMinLength || nicknameLength > AUTH_LIMITS.nicknameMaxLength) {
      e.nickname = `昵称 ${AUTH_LIMITS.nicknameMinLength}-${AUTH_LIMITS.nicknameMaxLength} 个字就好`;
    }
    const passwordError = validatePasswordField(registerForm.password);
    if (passwordError) e.password = passwordError;
    if (!registerForm.confirmPassword) e.confirmPassword = '请确认密码';
    else if (registerForm.password !== registerForm.confirmPassword) e.confirmPassword = '两次密码不一致';
    if (!registerForm.verificationCode) e.verificationCode = '请输入验证码';
    else if (!VERIFICATION_CODE_PATTERN.test(registerForm.verificationCode)) e.verificationCode = `验证码为 ${AUTH_LIMITS.verificationCodeLength} 位数字`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateReset = () => {
    const e: Record<string, string> = {};
    const emailErr = validateEmailField(resetForm.email);
    if (emailErr) e.email = emailErr;
    if (!resetForm.code) e.verificationCode = '请输入验证码';
    else if (!VERIFICATION_CODE_PATTERN.test(resetForm.code)) e.verificationCode = `验证码为 ${AUTH_LIMITS.verificationCodeLength} 位数字`;
    const passwordError = validatePasswordField(resetForm.newPassword, '请输入新密码');
    if (passwordError) e.password = passwordError;
    if (!resetForm.confirmPassword) e.confirmPassword = '请确认新密码';
    else if (resetForm.newPassword !== resetForm.confirmPassword) e.confirmPassword = '两次密码不一致';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleOpenReset = () => {
    const email = normalizeEmail(loginForm.email) || normalizeEmail(registerForm.email);
    setResetForm({
      email,
      code: '',
      newPassword: '',
      confirmPassword: '',
    });
    setErrors({});
    setInlineNotice('');
    setTab('reset');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineNotice('');
    if (!validateLogin()) return;
    setSubmitting(true);
    try {
      const email = normalizeEmail(loginForm.email);
      const result = await login(email, loginForm.password);
      setLoginForm((prev) => ({ ...prev, email }));
      const grantedCredits = Number.isFinite(result.creditsGranted) ? result.creditsGranted : 0;
      const redirectLine = cameFromWorldStart
        ? '这就带你回刚才那个世界…'
        : cameFromReport
          ? '这就带你回刚才那页…'
          : '这就带你回去…';
      const loginSuccessText = grantedCredits > 0
        ? result.bonusActivated
          ? `登录好了，送你的 ${grantedCredits} 积分已到账，当前 ${result.user.credits} 积分，${redirectLine}`
          : `登录好了，+${grantedCredits} 积分，当前 ${result.user.credits} 积分，${redirectLine}`
        : `登录好了，${redirectLine}`;
      toast.success(loginSuccessText);
      router.replace(redirectWithAction);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '登录失败，请重试';
      setErrors({ form: message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineNotice('');
    if (!validateRegister()) return;
    setSubmitting(true);
    try {
      const email = normalizeEmail(registerForm.email);
      const nickname = normalizeNickname(registerForm.nickname);
      const result = await register(email, registerForm.password, nickname, registerForm.verificationCode, registerForm.inviteCode || undefined);
      setRegisterForm((prev) => ({ ...prev, email, nickname }));
      const grantedCredits = Number.isFinite(result.creditsGranted) ? result.creditsGranted : 0;
      const rewardLine = grantedCredits > 0
        ? `送你 ${grantedCredits} 积分`
        : result.bonusActivated
          ? '欢迎礼已经记上了'
          : '账号已经准备好';
      const registerSuccessText = cameFromWorldStart
        ? cameFromSharedStory
          ? `欢迎加入，${nickname}。${rewardLine}，这就回到刚才那个世界。`
          : `欢迎加入，${nickname}。${rewardLine}，这就回到刚才那个世界。`
        : `欢迎加入，${nickname}。${rewardLine}，现在就能开场了。`;
      toast.success(registerSuccessText);
      router.replace(redirectWithAction);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '注册失败，请重试';
      if (isEmailAlreadyRegisteredError(message)) {
        const email = normalizeEmail(registerForm.email);
        setLoginForm((prev) => ({ ...prev, email }));
        setTab('login');
        setErrors({ email: '这个邮箱注册过了，直接登录就行。' });
        toast.info('这个邮箱注册过了，已经帮你切到登录');
      } else {
        setErrors({ form: message });
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineNotice('');
    if (!validateReset()) return;
    setSubmitting(true);
    try {
      const email = normalizeEmail(resetForm.email);
      const response = await authAPI.resetPassword(email, resetForm.code, resetForm.newPassword);
      const result = response.data || response;
      setLoginForm({ email, password: '' });
      setResetForm({ email, code: '', newPassword: '', confirmPassword: '' });
      setErrors({});
      setInlineNotice(result.message || '密码改好了，用新密码登录吧。');
      setTab('login');
      toast.success(result.message || '密码改好了，用新密码登录吧');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '重置失败，请重试';
      if (message.includes('验证码')) {
        setErrors({ verificationCode: message });
      } else if (message.includes('密码')) {
        setErrors({ password: message });
      } else if (message.includes('邮箱')) {
        setErrors({ email: message });
      } else {
        setErrors({ form: message });
      }
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const defaultAuthHeroTitle = tab === 'login'
    ? '欢迎回来'
    : tab === 'register'
      ? '加入入戏'
      : '找回密码';
  const authHeroTitle = cameFromWorldStart
    ? '先登录，刚才那段还在'
    : cameFromReport
      ? '登录一下，继续刚才的事'
      : defaultAuthHeroTitle;
  const authHeroDescription = cameFromWorldStart
    ? '弄好就回到你刚点开的世界。'
    : cameFromReport
      ? '弄好就回到刚才那页。'
      : '进度、收藏和积分，都跟着账号走。';
  const authHeroSnapshot = [
    {
      label: '新朋友',
      value: `注册送 ${SITE_CONFIG.app.registrationCredits} 积分，马上开始入戏`,
    },
    {
      label: '老朋友',
      value: '进度、收藏、积分都在账号里',
    },
  ];
  const mobileHeroTagline = 'AI 互动叙事，你就是主角';
  const currentTabTitle = tab === 'login'
    ? cameFromWorldStart
      ? '登录一下，接着这段'
      : cameFromReport
        ? '登录一下，继续刚才的事'
        : '欢迎回来'
    : tab === 'register'
      ? '加入入戏'
      : '找回密码';
  const currentTabDescription = tab === 'login'
    ? '填一下邮箱和密码，就回来了。'
    : tab === 'register'
      ? '收个验证码，起个名字就能进来。'
      : '收个验证码，换个新密码。';
  const currentTabMeta = tab === 'login'
    ? compactContextHint || '进度、收藏和积分都在账号里'
    : tab === 'register'
      ? `新号送 +${SITE_CONFIG.app.registrationCredits} 积分`
      : '邮箱验证码找回';
  const mobileInfoPills = tab === 'login'
    ? [compactContextHint || '回来就能接上', '收藏和积分都在']
    : tab === 'register'
      ? [`送 +${SITE_CONFIG.app.registrationCredits} 积分`, `每日 ${SITE_CONFIG.app.dailyFreePlays} 次免费互动`]
      : ['邮箱验证码找回', '改好就能登录'];

  if (user) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-8">
        <div className="rounded-[1.6rem] border border-gray-200 bg-white px-6 py-5 text-center shadow-sm">
          <p className="text-sm font-medium text-gray-900">{authLoading ? '正在确认账号…' : '正在回到刚才那页…'}</p>
          <p className="mt-1 text-xs text-gray-500">认出你啦，马上送你回去。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 sm:py-6 lg:px-6 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[86rem] items-start sm:items-center">
        <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(31rem,36rem)] lg:items-stretch lg:gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(32.5rem,37rem)]">
          <div className="hidden lg:flex">
            <div className="relative flex w-full flex-col overflow-hidden rounded-[2.2rem] bg-gradient-to-br from-brand-dark via-brand to-brand-light p-8 text-white shadow-[0_34px_90px_-40px_rgba(59,130,196,0.72)] xl:p-10">
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10" />
              <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10" />
              <div className="relative flex h-full flex-col">
                <div>
                  <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-white/90 backdrop-blur-sm">
                    {SITE_CONFIG.brandSignature}
                  </span>
                  <p className="mt-4 text-sm font-semibold tracking-[0.22em] text-white/75">
                    入戏账户
                  </p>
                  <h2 className="mt-3 text-4xl font-black leading-tight text-white xl:text-[2.85rem]">
                    {authHeroTitle}
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-white/88">
                    {authHeroDescription}
                  </p>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {authHeroSnapshot.map((item) => (
                    <div key={item.label} className="rounded-[1.45rem] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-sm">
                      <p className="text-xs font-medium text-white/70">{item.label}</p>
                      <p className="mt-1 text-base font-bold leading-6 text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none lg:justify-self-end">
            <div className="mb-4 overflow-hidden rounded-[1.8rem] bg-gradient-to-br from-brand-dark via-brand to-brand-light px-4 py-4 text-white shadow-[0_22px_50px_-32px_rgba(59,130,196,0.75)] lg:hidden">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-white/90 backdrop-blur-sm">
                  入戏账户
                </span>
                {compactContextHint ? (
                  <span className="inline-flex items-center rounded-full border border-white/18 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/88 backdrop-blur-sm">
                    {compactContextHint}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-3 text-[1.65rem] font-black leading-tight">{authHeroTitle}</h2>
              <p className="mt-2 text-sm font-medium text-white/92">{mobileHeroTagline}</p>
              <p className="mt-2 text-sm leading-6 text-white/88">{authHeroDescription}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {mobileInfoPills.map((item) => (
                  <span key={item} className="inline-flex items-center rounded-full border border-white/18 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/88 backdrop-blur-sm">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="ui-panel overflow-hidden px-4 py-4 sm:px-6 sm:py-5 lg:min-h-full lg:px-7 lg:py-6">
              <div className="mb-4 sm:mb-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-brand">
                    {SITE_CONFIG.brandSignature}
                  </span>
                  {compactContextHint ? (
                    <span className={focusChipClass}>
                      {compactContextHint}
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl">{currentTabTitle}</h1>
                <p className="mt-2 text-sm leading-6 text-gray-500">{currentTabDescription}</p>
                <p className="mt-3 rounded-2xl border border-brand/10 bg-brand/5 px-3.5 py-2 text-[11px] leading-5 text-brand sm:hidden">
                  {currentTabMeta}
                </p>
                <p className="mt-3 hidden text-xs leading-5 text-gray-500 sm:block">{currentTabMeta}</p>
              </div>


          {tab === 'reset' ? (
            <div className="mb-4 rounded-[1.4rem] border border-gray-100 bg-gray-50 px-4 py-3 text-sm sm:mb-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{resetIntroTitle}</p>
                  <p className="mt-1 text-xs leading-5 text-gray-600 sm:text-sm sm:leading-6">{resetIntroDescription}</p>
                </div>
                        <button
                          type="button"
                          onClick={() => openTab('register')}
                          disabled={isBusy}
                          className="inline-flex min-h-[44px] items-center px-2 py-2 font-medium text-gray-500 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300"
                        >
                          没有账号？去注册一个
                        </button>
              </div>
            </div>
          ) : (
            <div role="tablist" aria-label="登录或注册" className="mb-5 flex rounded-[1.4rem] bg-gray-100 p-1.5">
              <button
                ref={loginTabRef}
                id="auth-login-tab"
                type="button"
                role="tab"
                aria-selected={tab === 'login'}
                aria-controls="auth-login-panel"
                tabIndex={tab === 'login' ? 0 : -1}
                disabled={isBusy}
                onClick={() => openTab('login')}
                onKeyDown={handleTabKeyDown}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                  tab === 'login' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {loginTabLabel}
              </button>
              <button
                ref={registerTabRef}
                id="auth-register-tab"
                type="button"
                role="tab"
                aria-selected={tab === 'register'}
                aria-controls="auth-register-panel"
                tabIndex={tab === 'register' ? 0 : -1}
                disabled={isBusy}
                onClick={() => openTab('register')}
                onKeyDown={handleTabKeyDown}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                  tab === 'register' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {registerTabLabel}
              </button>
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {tab === 'login' && (
                <div role="tabpanel" id="auth-login-panel" aria-labelledby="auth-login-tab">
                  <div className={formCardClass}>
                    <form onSubmit={handleLogin} onFocusCapture={handleFieldFocusCapture} className="space-y-3.5 sm:space-y-4">
                      <div>
                        <label htmlFor="login-email" className="mb-1.5 block text-[13px] font-medium text-gray-700 sm:text-sm">
                          邮箱
                        </label>
                        <input
                          id="login-email"
                          type="email"
                          autoComplete="email"
                          aria-invalid={Boolean(errors.email)}
                          aria-describedby={errors.email ? 'login-email-error' : undefined}
                          value={loginForm.email}
                          onChange={(e) => {
                            setLoginForm({ ...loginForm, email: e.target.value });
                            if (errors.email) setErrors((prev) => { const n = { ...prev }; delete n.email; return n; });
                          }}
                          onBlur={(e) => {
                            const email = normalizeEmail(e.target.value);
                            setLoginForm((prev) => ({ ...prev, email }));
                            const err = validateEmailField(email);
                            if (err) setErrors((prev) => ({ ...prev, email: err }));
                          }}
                          placeholder="你常用的邮箱"
                          maxLength={SITE_CONFIG.limits.auth.emailMaxLength}
                          disabled={submitting}
                          className={getFieldInputClass(Boolean(errors.email))}
                        />
                        {errors.email && <p id="login-email-error" role="alert" className="mt-1.5 text-xs text-red-500">{errors.email}</p>}
                      </div>
                      <div>
                        <label htmlFor="login-password" className="mb-1.5 block text-[13px] font-medium text-gray-700 sm:text-sm">
                          密码
                        </label>
                        <input
                          id="login-password"
                          type="password"
                          autoComplete="current-password"
                          aria-invalid={Boolean(errors.password)}
                          aria-describedby={errors.password ? 'login-password-error' : undefined}
                          value={loginForm.password}
                          onChange={(e) => {
                            setLoginForm({ ...loginForm, password: e.target.value });
                            if (errors.password) setErrors((prev) => { const n = { ...prev }; delete n.password; return n; });
                          }}
                          placeholder="你的密码"
                          maxLength={AUTH_LIMITS.passwordMaxLength}
                          disabled={submitting}
                          className={getFieldInputClass(Boolean(errors.password))}
                        />
                        {errors.password && <p id="login-password-error" role="alert" className="mt-1.5 text-xs text-red-500">{errors.password}</p>}
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="ui-btn ui-btn-primary w-full rounded-xl py-3 text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? (
                          <span className="inline-flex items-center justify-center gap-2">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            登录中...
                          </span>
                        ) : loginButtonLabel}
                      </button>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => openTab('register')}
                          disabled={isBusy}
                          className="inline-flex min-h-[44px] items-center px-2 py-2 font-medium text-gray-500 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300"
                        >
                          没有账号？去注册一个
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenReset}
                          disabled={isBusy}
                          className="inline-flex min-h-[44px] items-center px-2 py-2 font-medium text-brand transition-colors hover:text-brand-dark disabled:cursor-not-allowed disabled:text-gray-300"
                        >
                          忘记密码
                        </button>
                      </div>
                      {inlineNotice && <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-center text-xs text-emerald-700 ring-1 ring-emerald-100">{inlineNotice}</p>}
                      {errors.form && <p role="alert" className="text-center text-xs text-red-500">{errors.form}</p>}
                    </form>
                  </div>
                </div>
              )}

              {tab === 'reset' && (
                <div role="tabpanel" id="auth-reset-panel" aria-label="重置密码">
                  <div className={formCardClass}>
                    <form onSubmit={handleResetPassword} onFocusCapture={handleFieldFocusCapture} className="space-y-3.5 sm:space-y-4">
                      <div>
                        <label htmlFor="reset-email" className="mb-1.5 block text-[13px] font-medium text-gray-700 sm:text-sm">
                          邮箱
                        </label>
                        <input
                          id="reset-email"
                          type="email"
                          autoComplete="email"
                          aria-invalid={Boolean(errors.email)}
                          aria-describedby={errors.email ? 'reset-email-error' : undefined}
                          value={resetForm.email}
                          onChange={(e) => {
                            setResetForm({ ...resetForm, email: e.target.value });
                            setInlineNotice('');
                            if (errors.email) setErrors((prev) => { const next = { ...prev }; delete next.email; return next; });
                          }}
                          onBlur={(e) => {
                            const email = normalizeEmail(e.target.value);
                            setResetForm((prev) => ({ ...prev, email }));
                            const err = validateEmailField(email);
                            if (err) setErrors((prev) => ({ ...prev, email: err }));
                          }}
                          placeholder="注册用的邮箱"
                          maxLength={SITE_CONFIG.limits.auth.emailMaxLength}
                          disabled={isBusy}
                          className={getFieldInputClass(Boolean(errors.email))}
                        />
                        {errors.email && <p id="reset-email-error" role="alert" className="mt-1.5 text-xs text-red-500">{errors.email}</p>}
                      </div>
                      <div>
                        <label htmlFor="reset-code" className="mb-1.5 block text-[13px] font-medium text-gray-700 sm:text-sm">
                          验证码
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="reset-code"
                            type="text"
                            autoComplete="one-time-code"
                            aria-invalid={Boolean(errors.verificationCode)}
                            aria-describedby={errors.verificationCode ? 'reset-code-error' : undefined}
                            inputMode="numeric"
                            maxLength={AUTH_LIMITS.verificationCodeLength}
                            value={resetForm.code}
                            onChange={(e) => {
                              setResetForm({ ...resetForm, code: e.target.value.replace(/\D/g, '') });
                              if (errors.verificationCode) setErrors((prev) => { const next = { ...prev }; delete next.verificationCode; return next; });
                            }}
                            placeholder={`${AUTH_LIMITS.verificationCodeLength} 位数字`}
                            disabled={isBusy}
                            className={`${getFieldInputClass(Boolean(errors.verificationCode))} flex-1`}
                          />
                          <button
                            type="button"
                            disabled={resetCountdown > 0 || isSendingResetCode || submitting}
                            onClick={() => handleSendCode('reset')}
                            aria-label={isSendingResetCode ? '正在发送验证码' : resetCountdown > 0 ? `${resetCountdown} 秒后可重新发送验证码` : '发送验证码'}
                            className="ui-btn ui-btn-soft shrink-0 rounded-xl px-4 py-3 text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSendingResetCode ? '发送中...' : resetCountdown > 0 ? `${resetCountdown}s` : '发送验证码'}
                          </button>
                        </div>
                        {errors.verificationCode && <p id="reset-code-error" role="alert" className="mt-1.5 text-xs text-red-500">{errors.verificationCode}</p>}
                        <p className={`mt-1.5 text-xs ${resetCountdown > 0 && !resetEmailError ? 'text-emerald-600' : 'text-gray-500'}`}>
                          {resetVerificationHint}
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="reset-password" className="mb-1.5 block text-[13px] font-medium text-gray-700 sm:text-sm">
                            新密码
                          </label>
                          <input
                            id="reset-password"
                            type="password"
                            autoComplete="new-password"
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={errors.password ? 'reset-password-error' : undefined}
                            value={resetForm.newPassword}
                            onChange={(e) => {
                              const nextPassword = e.target.value;
                              setResetForm({ ...resetForm, newPassword: nextPassword });
                              setErrors((prev) => {
                                const next = { ...prev };
                                if (next.password) delete next.password;
                                if (resetForm.confirmPassword) {
                                  if (nextPassword !== resetForm.confirmPassword) next.confirmPassword = '两次密码不一致';
                                  else delete next.confirmPassword;
                                }
                                return next;
                              });
                            }}
                            placeholder={`至少 ${SITE_CONFIG.limits.auth.passwordMinLength} 位密码`}
                            maxLength={AUTH_LIMITS.passwordMaxLength}
                            disabled={submitting}
                            className={getFieldInputClass(Boolean(errors.password))}
                          />
                          {resetForm.newPassword && (() => {
                            const strength = validatePasswordStrength(resetForm.newPassword);
                            return (
                              <div className="mt-1.5 space-y-1">
                                <div className="flex gap-1">
                                  {[1, 2, 3].map((i) => (
                                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.level ? strength.color : 'bg-gray-200'}`} />
                                  ))}
                                </div>
                                <p className={`text-xs ${strength.level === 1 ? 'text-red-500' : strength.level === 2 ? 'text-yellow-700' : 'text-green-700'}`}>
                                  密码强度：{strength.label}
                                </p>
                              </div>
                            );
                          })()}
                          {errors.password && <p id="reset-password-error" role="alert" className="mt-1.5 text-xs text-red-500">{errors.password}</p>}
                        </div>
                        <div>
                          <label htmlFor="reset-confirm" className="mb-1.5 block text-[13px] font-medium text-gray-700 sm:text-sm">
                            确认新密码
                          </label>
                          <input
                            id="reset-confirm"
                            type="password"
                            autoComplete="new-password"
                            aria-invalid={Boolean(errors.confirmPassword)}
                            aria-describedby={errors.confirmPassword ? 'reset-confirm-error' : undefined}
                            value={resetForm.confirmPassword}
                            onChange={(e) => {
                              const nextConfirmPassword = e.target.value;
                              setResetForm({ ...resetForm, confirmPassword: nextConfirmPassword });
                              setErrors((prev) => {
                                const next = { ...prev };
                                if (!nextConfirmPassword) {
                                  delete next.confirmPassword;
                                  return next;
                                }
                                if (resetForm.newPassword === nextConfirmPassword) delete next.confirmPassword;
                                else next.confirmPassword = '两次密码不一致';
                                return next;
                              });
                            }}
                            onBlur={(e) => {
                              if (e.target.value && resetForm.newPassword !== e.target.value) {
                                setErrors((prev) => ({ ...prev, confirmPassword: '两次密码不一致' }));
                                return;
                              }
                              if (e.target.value) {
                                setErrors((prev) => {
                                  const next = { ...prev };
                                  delete next.confirmPassword;
                                  return next;
                                });
                              }
                            }}
                            placeholder="再次输入新密码"
                            maxLength={AUTH_LIMITS.passwordMaxLength}
                            disabled={submitting}
                            className={getFieldInputClass(Boolean(errors.confirmPassword))}
                          />
                          {errors.confirmPassword && <p id="reset-confirm-error" role="alert" className="mt-1.5 text-xs text-red-500">{errors.confirmPassword}</p>}
                          {!errors.confirmPassword && resetConfirmPasswordHint && (
                            <p className={`mt-1.5 text-xs ${resetForm.newPassword === resetForm.confirmPassword ? 'text-emerald-600' : 'text-gray-500'}`}>
                              {resetConfirmPasswordHint}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="ui-btn ui-btn-primary w-full rounded-xl py-3 text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? (
                          <span className="inline-flex items-center justify-center gap-2">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            重置中...
                          </span>
                        ) : '换好密码'}
                      </button>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => openTab('login')}
                          disabled={isBusy}
                          className="inline-flex min-h-[44px] items-center px-2 py-2 font-medium text-brand transition-colors hover:text-brand-dark disabled:cursor-not-allowed disabled:text-gray-300"
                        >
                          回登录
                        </button>
                        <button
                          type="button"
                          onClick={() => openTab('register')}
                          disabled={isBusy}
                          className="inline-flex min-h-[44px] items-center px-2 py-2 font-medium text-gray-500 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300"
                        >
                          没有账号？去注册一个
                        </button>
                      </div>
                      {errors.form && <p role="alert" className="text-center text-xs text-red-500">{errors.form}</p>}
                    </form>
                  </div>
                </div>
              )}

              {tab === 'register' && (
                <div role="tabpanel" id="auth-register-panel" aria-labelledby="auth-register-tab">
                  <div className={formCardClass}>
                    <form onSubmit={handleRegister} onFocusCapture={handleFieldFocusCapture} className="space-y-3.5 sm:space-y-4">
                      <div>
                        <label htmlFor="reg-email" className="mb-1.5 block text-[13px] font-medium text-gray-700 sm:text-sm">
                          邮箱
                        </label>
                        <input
                          id="reg-email"
                          type="email"
                          autoComplete="email"
                          aria-invalid={Boolean(errors.email)}
                          aria-describedby={errors.email ? 'reg-email-error' : undefined}
                          value={registerForm.email}
                          onChange={(e) => {
                            setRegisterForm({ ...registerForm, email: e.target.value });
                            if (errors.email) setErrors((prev) => { const n = { ...prev }; delete n.email; return n; });
                          }}
                          onBlur={(e) => {
                            const email = normalizeEmail(e.target.value);
                            setRegisterForm((prev) => ({ ...prev, email }));
                            const err = validateEmailField(email);
                            if (err) {
                              setErrors((prev) => ({ ...prev, email: err }));
                              return;
                            }
                            suggestNicknameIfBlank(email);
                          }}
                          placeholder="常用邮箱"
                          maxLength={SITE_CONFIG.limits.auth.emailMaxLength}
                          disabled={isBusy}
                          className={getFieldInputClass(Boolean(errors.email))}
                        />
                        {errors.email && <p id="reg-email-error" role="alert" className="mt-1.5 text-xs text-red-500">{errors.email}</p>}
                        {!errors.email && (
                          <p className={`mt-1.5 text-xs ${normalizedRegisterEmail ? 'text-emerald-600' : 'text-gray-500'}`}>
                            {normalizedRegisterEmail
                              ? `验证码会发到 ${normalizedRegisterEmail}。`
                              : '先填邮箱，再拿验证码。'}
                          </p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="reg-code" className="mb-1.5 block text-[13px] font-medium text-gray-700 sm:text-sm">
                          验证码
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="reg-code"
                            type="text"
                            autoComplete="one-time-code"
                            aria-invalid={Boolean(errors.verificationCode)}
                            aria-describedby={errors.verificationCode ? 'reg-code-error' : undefined}
                            inputMode="numeric"
                            maxLength={AUTH_LIMITS.verificationCodeLength}
                            value={registerForm.verificationCode}
                            onChange={(e) => {
                              setRegisterForm({ ...registerForm, verificationCode: e.target.value.replace(/\D/g, '') });
                              if (errors.verificationCode) setErrors((prev) => { const n = { ...prev }; delete n.verificationCode; return n; });
                            }}
                            placeholder={`${AUTH_LIMITS.verificationCodeLength} 位数字`}
                            disabled={submitting}
                            className={`${getFieldInputClass(Boolean(errors.verificationCode))} flex-1`}
                          />
                          <button
                            type="button"
                            disabled={registerCountdown > 0 || isSendingRegisterCode || submitting}
                            onClick={() => handleSendCode('register')}
                            aria-label={isSendingRegisterCode ? '正在发送验证码' : registerCountdown > 0 ? `${registerCountdown} 秒后可重新获取验证码` : '获取验证码'}
                            className="ui-btn ui-btn-soft shrink-0 rounded-xl px-4 py-3 text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSendingRegisterCode ? '发送中...' : registerCountdown > 0 ? `${registerCountdown}s` : '获取验证码'}
                          </button>
                        </div>
                        {errors.verificationCode && <p id="reg-code-error" role="alert" className="mt-1.5 text-xs text-red-500">{errors.verificationCode}</p>}
                        {!errors.verificationCode && (
                          <p className={`mt-1.5 text-xs ${registerCountdown > 0 && !registerEmailError ? 'text-emerald-600' : 'text-gray-500'}`}>
                            {registerVerificationHint}
                          </p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="reg-nickname" className="mb-1.5 block text-[13px] font-medium text-gray-700 sm:text-sm">
                          昵称
                        </label>
                        <input
                          id="reg-nickname"
                          type="text"
                          autoComplete="username"
                          aria-invalid={Boolean(errors.nickname)}
                          aria-describedby={errors.nickname ? 'reg-nickname-error' : undefined}
                          value={registerForm.nickname}
                          onChange={(e) => {
                            const nextNickname = truncateText(e.target.value, SITE_CONFIG.limits.auth.nicknameMaxLength);
                            setRegisterForm({ ...registerForm, nickname: nextNickname });
                            if (errors.nickname) setErrors((prev) => { const n = { ...prev }; delete n.nickname; return n; });
                          }}
                          onBlur={(e) => {
                            const nickname = normalizeNickname(e.target.value);
                            setRegisterForm((prev) => ({ ...prev, nickname }));
                            const nicknameLength = getTextLength(nickname);
                            if (nickname && (nicknameLength < SITE_CONFIG.limits.auth.nicknameMinLength || nicknameLength > SITE_CONFIG.limits.auth.nicknameMaxLength)) {
                              setErrors((prev) => ({ ...prev, nickname: `昵称 ${SITE_CONFIG.limits.auth.nicknameMinLength}-${SITE_CONFIG.limits.auth.nicknameMaxLength} 个字就好` }));
                            }
                          }}
                          placeholder="你想别人怎么叫你"
                          maxLength={NICKNAME_INPUT_MAX_LENGTH}
                          disabled={submitting}
                          className={getFieldInputClass(Boolean(errors.nickname))}
                        />
                        {errors.nickname && <p id="reg-nickname-error" role="alert" className="mt-1.5 text-xs text-red-500">{errors.nickname}</p>}
                        {!errors.nickname && <p className="mt-1.5 text-xs text-gray-500">{registerNicknameHint}</p>}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="reg-password" className="mb-1.5 block text-[13px] font-medium text-gray-700 sm:text-sm">
                            密码
                          </label>
                          <input
                            id="reg-password"
                            type="password"
                            autoComplete="new-password"
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={errors.password ? 'reg-password-error' : undefined}
                            value={registerForm.password}
                            onChange={(e) => {
                              const nextPassword = e.target.value;
                              setRegisterForm({ ...registerForm, password: nextPassword });
                              setErrors((prev) => {
                                const next = { ...prev };
                                if (next.password) delete next.password;
                                if (registerForm.confirmPassword) {
                                  if (nextPassword !== registerForm.confirmPassword) next.confirmPassword = '两次密码不一致';
                                  else delete next.confirmPassword;
                                }
                                return next;
                              });
                            }}
                            placeholder={`至少 ${SITE_CONFIG.limits.auth.passwordMinLength} 位密码`}
                            maxLength={AUTH_LIMITS.passwordMaxLength}
                            disabled={submitting}
                            className={getFieldInputClass(Boolean(errors.password))}
                          />
                          {registerForm.password && (
                            <div className="mt-1.5 space-y-1">
                              <div className="flex gap-1">
                                {[1, 2, 3].map((i) => (
                                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= registerPasswordStrength.level ? registerPasswordStrength.color : 'bg-gray-200'}`} />
                                ))}
                              </div>
                              <p className={`text-xs ${registerPasswordStrength.level === 1 ? 'text-red-500' : registerPasswordStrength.level === 2 ? 'text-yellow-700' : 'text-green-700'}`}>
                                密码强度：{registerPasswordStrength.label}
                              </p>
                            </div>
                          )}
                          {errors.password && <p id="reg-password-error" role="alert" className="mt-1.5 text-xs text-red-500">{errors.password}</p>}
                        </div>
                        <div>
                          <label htmlFor="reg-confirm" className="mb-1.5 block text-[13px] font-medium text-gray-700 sm:text-sm">
                            确认密码
                          </label>
                          <input
                            id="reg-confirm"
                            type="password"
                            autoComplete="new-password"
                            aria-invalid={Boolean(errors.confirmPassword)}
                            aria-describedby={errors.confirmPassword ? 'reg-confirm-error' : undefined}
                            value={registerForm.confirmPassword}
                            onChange={(e) => {
                              const nextConfirmPassword = e.target.value;
                              setRegisterForm({ ...registerForm, confirmPassword: nextConfirmPassword });
                              setErrors((prev) => {
                                const next = { ...prev };
                                if (!nextConfirmPassword) {
                                  delete next.confirmPassword;
                                  return next;
                                }
                                if (registerForm.password === nextConfirmPassword) delete next.confirmPassword;
                                else next.confirmPassword = '两次密码不一致';
                                return next;
                              });
                            }}
                            onBlur={(e) => {
                              if (e.target.value && registerForm.password !== e.target.value) {
                                setErrors((prev) => ({ ...prev, confirmPassword: '两次密码不一致' }));
                                return;
                              }
                              if (e.target.value) {
                                setErrors((prev) => {
                                  const next = { ...prev };
                                  delete next.confirmPassword;
                                  return next;
                                });
                              }
                            }}
                            placeholder="再输一次"
                            maxLength={AUTH_LIMITS.passwordMaxLength}
                            disabled={submitting}
                            className={getFieldInputClass(Boolean(errors.confirmPassword))}
                          />
                          {errors.confirmPassword && <p id="reg-confirm-error" role="alert" className="mt-1.5 text-xs text-red-500">{errors.confirmPassword}</p>}
                          {!errors.confirmPassword && registerConfirmPasswordHint && (
                            <p className={`mt-1.5 text-xs ${registerForm.password === registerForm.confirmPassword ? 'text-emerald-600' : 'text-gray-500'}`}>
                              {registerConfirmPasswordHint}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        {showInviteField ? (
                          <div id="reg-invite-field">
                            <div className="mb-1.5 flex items-center justify-between gap-3">
                              <label htmlFor="reg-invite" className="block text-[13px] font-medium text-gray-700 sm:text-sm">
                                邀请码 <span className="font-normal text-gray-500">(选填)</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowInviteField(false);
                                  setRegisterForm((prev) => ({ ...prev, inviteCode: '' }));
                                }}
                                disabled={submitting}
                                className="text-xs font-medium text-gray-500 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300 cursor-pointer"
                              >
                                收起
                              </button>
                            </div>
                            <input
                              id="reg-invite"
                              type="text"
                              autoComplete="off"
                              value={registerForm.inviteCode}
                              onChange={(e) => setRegisterForm({ ...registerForm, inviteCode: e.target.value })}
                              placeholder="有就填，没有直接跳过"
                              disabled={submitting}
                              className={getFieldInputClass(false)}
                            />
                            <p className="mt-1.5 text-xs text-gray-500">没有也能注册。</p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowInviteField(true)}
                            aria-expanded={showInviteField}
                            aria-controls="reg-invite-field"
                            disabled={submitting}
                            className="ui-btn ui-btn-secondary flex w-full items-center justify-between rounded-xl border-dashed px-4 py-3 text-left text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span>有邀请码？点这里</span>
                            <span aria-hidden="true">＋</span>
                          </button>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="ui-btn ui-btn-primary w-full rounded-xl py-3 text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? (
                          <span className="inline-flex items-center justify-center gap-2">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            注册中...
                          </span>
                        ) : registerButtonLabel}
                      </button>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => openTab('login')}
                          disabled={isBusy}
                          className="inline-flex min-h-[44px] items-center px-2 py-2 font-medium text-brand transition-colors hover:text-brand-dark disabled:cursor-not-allowed disabled:text-gray-300"
                        >
                          已有账号，去登录
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenReset}
                          disabled={isBusy}
                          className="inline-flex min-h-[44px] items-center px-2 py-2 font-medium text-gray-500 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300"
                        >
                          忘记密码
                        </button>
                      </div>
                      {errors.form && <p role="alert" className="text-center text-xs text-red-500">{errors.form}</p>}
                    </form>
                  </div>
                </div>
              )}
            </m.div>
            </AnimatePresence>
          </div>

          <p className="mt-4 hidden text-center text-xs leading-5 text-gray-400 sm:block">
            遇到问题，可联系 QQ {SITE_CONFIG.contact.qq} / 微信 {SITE_CONFIG.contact.wechat}
          </p>
        </div>
      </div>
    </div>
  </div>
  );
}

export default function AuthClient({ redirect, action }: AuthClientProps) {
  return <AuthContent redirect={redirect} action={action} />;
}
