import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useToast } from '@/app/contexts/ToastContext';
import {
  applyInviteDraftPayloadToForm,
  buildInviteDraftPayloadV1,
  type InviteDraftFormInput,
} from '@/app/utils/buildInviteDraftPayloadV1';
import { setAccentColorCssVars } from '@/app/utils/themeBackground';

interface OnboardingPanelProps {
  artistName: string;
  onArtistNameChange: (name: string) => void;
  onSave: (data: any) => void;
  onExit: () => void;
  uploadedFile?: File | null;
  filePreviewUrl?: string | null;
  onUploadClick?: () => void;
  mode?: 'onboarding' | 'upload-asset';
  existingArtist?: any;
  /** Optional treasure draft payload (invite handoff); applied once when mode is onboarding. */
  initialInviteDraft?: Record<string, unknown> | null;
  isAdmin?: boolean;
  getDidToken?: () => Promise<string | null>;
  /** When opening onboarding from claim handoff, carry coin id for draft workshop + snapshot. */
  inviteLaunchCoinPublicId?: string | null;
  /** Workshop draft orbit: parent registers loader to call same hydrate path as paste+Load. */
  onRegisterLoadTreasureDraftByCoin?: (loadByCoin: (coin: string) => Promise<void>) => void;
  /** Admin workshop: sync coin to parent so hero featured upload can gate on draft-upload. */
  onTreasureDraftCoinPublicIdChange?: (coinPublicId: string | null) => void;
  /** Mirror persisted HTTPS featured URL for hero when local File preview is cleared. */
  onWorkshopFeaturedHttpsChange?: (url: string | null) => void;
  /** Before revert / baseline restore: clear parent hero staged File + blob preview. */
  onClearWorkshopHeroStaging?: () => void;
  /** Parent registers hero featured draft-upload + clear (admin onboarding only). */
  onRegisterWorkshopFeaturedHandlers?: (
    handlers: {
      uploadFeatured: (file: File) => Promise<boolean>;
      clearFeatured: () => void;
    } | null,
  ) => void;
  /** Parent locks primary CTA during async artist launch ceremony */
  artistLaunchLocksPrimaryButton?: boolean;
  /** Live preview: stardust checkbox toggled during onboarding workshop */
  onStardustPreviewChange?: (enabled: boolean) => void;
}

type TreasureCommittedSnapshot = {
  form: InviteDraftFormInput;
  coinPublicId: string | null;
  reservedEmail: string;
};

function createInviteFormBaseline(
  mode: 'onboarding' | 'upload-asset',
  existingArtist?: Record<string, unknown>
): InviteDraftFormInput {
  return {
    displayname: mode === 'upload-asset' ? String(existingArtist?.name ?? '') : '',
    tokenName: mode === 'upload-asset' ? String(existingArtist?.tokenName ?? '') : '',
    artworktitle: mode === 'upload-asset' ? 'New Content' : 'Featured Content #1',
    artworkyear: '2025',
    downloadPrice: 1.0,
    description: '',
    videosrc: '',
    logo_url: null,
    background_image_url: null,
    featured_asset_url: null,
    logo_use_background: false,
    background_use_image: false,
    theme: {
      fontFamily: 'Bungee, cursive',
      primaryColor: '#CD7F32',
      accentColor: '#A0522D',
      gradientStart: '#CD7F32',
      gradientMiddle: '#D4934A',
      gradientEnd: '#A0522D',
      stardust: false,
    },
  };
}

function cloneInviteDraftForm(f: InviteDraftFormInput): InviteDraftFormInput {
  return JSON.parse(JSON.stringify(f)) as InviteDraftFormInput;
}

function isDraftMediaHttps(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith('https://');
}

/** POST /api/invite/draft-upload — no React state or busy spinner (reuse for picker + Save flush). */
async function postInviteDraftUpload(
  getDidToken: () => Promise<string | null>,
  coinId: string,
  kind: 'logo' | 'background' | 'featured',
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const token = await getDidToken();
  if (!token) return { ok: false, error: 'Sign in required for draft upload.' };

  const fd = new FormData();
  fd.append('coin_public_id', coinId);
  fd.append('kind', kind);
  fd.append('file', file);

  try {
    const res = await fetch('/api/invite/draft-upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.error === 'string' ? data.error : 'Draft upload failed',
      };
    }
    const url = typeof data.url === 'string' ? data.url : '';
    if (!url.startsWith('https://')) {
      return { ok: false, error: 'Upload did not return an HTTPS URL' };
    }
    return { ok: true, url };
  } catch {
    return { ok: false, error: 'Draft upload failed' };
  }
}

function clientTreasureUrlForInvite(artistSlug: string, coinPublicId: string): string {
  const base =
    process.env.NEXT_PUBLIC_INVITE_BASE_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}`
      : 'https://test.artistocks.io');
  const u = new URL(base);
  u.pathname = '/';
  u.search = '';
  u.hash = '';
  const q = new URLSearchParams();
  q.set('artist', artistSlug);
  q.set('coin', coinPublicId);
  return `${u.origin}/?${q.toString()}`;
}

/** Matches slugFromDisplayName (server save-draft slug lock). */
function clientSlugFromDisplayName(displayname: string): string {
  const s = displayname
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const out = s.slice(0, 80);
  if (!out) throw new Error('Invalid artist name for slug');
  return out;
}

/** After admin-draft hydrate: mirror handleFieldChange DOM effects so workshop canvas/halo match form. */
function applyWorkshopVisualsFromInviteDraftForm(form: InviteDraftFormInput) {
  if (typeof document === 'undefined') return;

  const bgHttps =
    typeof form.background_image_url === 'string' && form.background_image_url.startsWith('https://')
      ? form.background_image_url
      : null;
  const logoHttps =
    typeof form.logo_url === 'string' && form.logo_url.startsWith('https://') ? form.logo_url : null;

  if (form.background_use_image && bgHttps) {
    document.body.style.backgroundImage = `url(${bgHttps})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';
  } else if (form.logo_use_background && logoHttps) {
    document.body.style.backgroundImage = `url(${logoHttps})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';
  } else {
    document.body.style.backgroundImage = 'none';
    document.body.style.background = form.theme.primaryColor;
  }

  window.dispatchEvent(
    new CustomEvent('primaryColorChange', { detail: { color: form.theme.primaryColor } }),
  );

  document.documentElement.style.setProperty('--primary-color', form.theme.primaryColor);
  setAccentColorCssVars(form.theme.accentColor);
  document.documentElement.style.setProperty('--gradient-start', form.theme.gradientStart);
  document.documentElement.style.setProperty('--gradient-middle', form.theme.gradientMiddle);
  document.documentElement.style.setProperty('--gradient-end', form.theme.gradientEnd);

  const headerElement = document.querySelector('h1');
  if (headerElement) {
    headerElement.style.color = form.theme.accentColor;
    headerElement.style.fontFamily = form.theme.fontFamily;
  }
  document.body.style.fontFamily = form.theme.fontFamily;
}

const COLOR_PRESETS = {
  gold: { name: "Gold", primary: "#FFD700", accent: "#B8860B" },
  silver: { name: "Silver", primary: "#C0C0C0", accent: "#808080" },
  bronze: { name: "Bronze", primary: "#CD7F32", accent: "#A0522D" },
  emerald: { name: "Emerald", primary: "#50C878", accent: "#228B22" },
  sapphire: { name: "Sapphire", primary: "#0F52BA", accent: "#1E40AF" },
  ruby: { name: "Ruby", primary: "#E0115F", accent: "#B22222" },
  black: { name: "Black", primary: "#1a1a1a", accent: "#404040" },
  white: { name: "White", primary: "#F8F8FF", accent: "#4A4A4A" }
};

const FONT_OPTIONS = [
  { name: "Bungee", value: "Bungee, cursive" },
  { name: "Geist", value: "Geist, sans-serif" },
  { name: "Inter", value: "Inter, sans-serif" },
  { name: "DM Sans", value: "DM Sans, sans-serif" },
  { name: "Space Grotesk", value: "Space Grotesk, sans-serif" },
  { name: "Instrument Sans", value: "Instrument Sans, sans-serif" }
];

const COMMON_FONTS = [
  "Arial, sans-serif",
  "Helvetica, sans-serif", 
  "Times New Roman, serif",
  "Georgia, serif",
  "Verdana, sans-serif",
  "Trebuchet MS, sans-serif",
  "Roboto, sans-serif",
  "Open Sans, sans-serif",
  "Lato, sans-serif",
  "Montserrat, sans-serif",
  "Poppins, sans-serif",
  "Nunito, sans-serif",
  "Raleway, sans-serif",
  "Source Sans Pro, sans-serif",
  "Ubuntu, sans-serif",
  "Merriweather, serif",
  "Playfair Display, serif",
  "Oswald, sans-serif",
  "Pacifico, cursive",
  "Dancing Script, cursive"
];

// Local dropdown component reused for onboarding
const FontDropdownOnboarding: React.FC<{
  onSelect: (font: string) => void;
  current?: string;
  onOpenChange?: (open: boolean) => void;
}> = ({ onSelect, current, onOpenChange }) => {
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [fontSearch, setFontSearch] = useState('');

  const setDropdownOpen = (open: boolean) => {
    setShowFontDropdown(open);
    onOpenChange?.(open);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={fontSearch}
        onChange={(e) => setFontSearch(e.target.value)}
        onFocus={() => setDropdownOpen(true)}
        placeholder={current || "Search fonts... (e.g. Arial, Roboto, Times)"}
        className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm focus:border-yellow-500"
        style={{ fontFamily: current }}
      />

      {showFontDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded max-h-40 overflow-y-auto z-[110] shadow-lg">
          {COMMON_FONTS
            .filter(font => font.toLowerCase().includes(fontSearch.toLowerCase()))
            .map((font) => (
              <button
                key={font}
                onClick={() => {
                  onSelect(font);
                  // Clear the search so reopening shows the full list
                  setFontSearch('');
                  setDropdownOpen(false);
                }}
                className="w-full text-left p-2 hover:bg-gray-700 text-white text-sm transition-colors"
                style={{ fontFamily: font }}
              >
                {font}
              </button>
            ))}
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {showFontDropdown && (
        <div 
          className="fixed inset-0 z-[105]" 
          onClick={() => setDropdownOpen(false)}
        />
      )}
    </div>
  );
};

const OnboardingPanel: React.FC<OnboardingPanelProps> = ({
  artistName,
  onArtistNameChange,
  onSave,
  onExit,
  uploadedFile,
  filePreviewUrl,
  onUploadClick,
  mode = 'onboarding',
  existingArtist,
  initialInviteDraft = null,
  isAdmin = false,
  getDidToken,
  inviteLaunchCoinPublicId = null,
  onRegisterLoadTreasureDraftByCoin,
  onTreasureDraftCoinPublicIdChange,
  onWorkshopFeaturedHttpsChange,
  onClearWorkshopHeroStaging,
  onRegisterWorkshopFeaturedHandlers,
  artistLaunchLocksPrimaryButton = false,
  onStardustPreviewChange,
}) => {
  const { showToast } = useToast();
  const ea = existingArtist as Record<string, unknown> | undefined;
  const [formData, setFormData] = useState<InviteDraftFormInput>(() =>
    createInviteFormBaseline(mode, ea)
  );
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);

  useEffect(() => {
    if (mode !== 'onboarding') return;
    onStardustPreviewChange?.(formData.theme.stardust === true);
  }, [formData.theme.stardust, mode, onStardustPreviewChange]);

  const inviteSeedAppliedRef = useRef(false);

  /** Coin id returned from save-draft / admin-draft load / invite handoff bridge. */
  const [treasureDraftCoinPublicId, setTreasureDraftCoinPublicId] = useState<string | null>(null);
  const [treasureDraftReservedEmail, setTreasureDraftReservedEmail] = useState('');
  const [loadTreasureDraftCoinQuery, setLoadTreasureDraftCoinQuery] = useState('');
  const [treasureDraftTreasureUrl, setTreasureDraftTreasureUrl] = useState<string | null>(null);
  const [committedTreasureSnapshot, setCommittedTreasureSnapshot] =
    useState<TreasureCommittedSnapshot | null>(null);
  const [treasureBusy, setTreasureBusy] = useState<'idle' | 'upload' | 'save' | 'load'>('idle');

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);

  useEffect(() => {
    const c = typeof inviteLaunchCoinPublicId === 'string' ? inviteLaunchCoinPublicId.trim() : '';
    if (c) setTreasureDraftCoinPublicId(c);
  }, [inviteLaunchCoinPublicId]);

  useEffect(() => {
    if (mode !== 'onboarding' || !initialInviteDraft || inviteSeedAppliedRef.current) return;
    inviteSeedAppliedRef.current = true;
    const d = initialInviteDraft;

    const base = createInviteFormBaseline(mode, ea);
    const merged = applyInviteDraftPayloadToForm(base, d);
    setFormData(merged);

    const dn = merged.displayname?.trim?.() || merged.tokenName?.trim?.() || '';
    if (dn) onArtistNameChange(dn);

    setLogoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      if (merged.logo_url && merged.logo_url.startsWith('https://')) return merged.logo_url;
      if (merged.logo_url === null) return null;
      return prev;
    });
    setBackgroundPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      if (merged.background_image_url && merged.background_image_url.startsWith('https://')) {
        return merged.background_image_url;
      }
      if (merged.background_image_url === null) return null;
      return prev;
    });

    const coinFromBridge =
      typeof inviteLaunchCoinPublicId === 'string' ? inviteLaunchCoinPublicId.trim() : '';
    if (coinFromBridge) setTreasureDraftCoinPublicId(coinFromBridge);

    const snapCoin = coinFromBridge || null;
    setCommittedTreasureSnapshot({
      form: cloneInviteDraftForm(merged),
      coinPublicId: snapCoin,
      reservedEmail: '',
    });

    if (snapCoin && merged.displayname.trim()) {
      try {
        const slugGuess = clientSlugFromDisplayName(merged.displayname);
        setTreasureDraftTreasureUrl(clientTreasureUrlForInvite(slugGuess, snapCoin));
      } catch {
        /* non-fatal — URL omitted until save/load echo */
      }
    }

    if (mode === 'onboarding') {
      applyWorkshopVisualsFromInviteDraftForm(merged);
    }

    const featuredHttps = merged.featured_asset_url?.startsWith('https://')
      ? merged.featured_asset_url
      : null;
    if (featuredHttps && (isAdmin || coinFromBridge)) {
      onWorkshopFeaturedHttpsChange?.(featuredHttps);
    }
  }, [
    ea,
    initialInviteDraft,
    inviteLaunchCoinPublicId,
    isAdmin,
    mode,
    onArtistNameChange,
    onWorkshopFeaturedHttpsChange,
  ]);

  // Halo init: baseline workshop color — skip when merging an invite-handoff draft so seed + applyWorkshopVisuals stays authoritative (avoids #FAF0E6 overwriting livePrimaryColor).
  useEffect(() => {
    if (initialInviteDraft) return;
    window.dispatchEvent(new CustomEvent('primaryColorChange', { detail: { color: formData.theme.primaryColor } }));
  }, [initialInviteDraft]);

  const handleFieldChange = useCallback((field: string, value: any) => {
    // Handle artist name change separately to avoid React render error
    if (field === 'displayname') {
      onArtistNameChange(value);
    }
    
    setFormData(prev => {
      const updated = { ...prev };
      
      if (field === 'displayname') {
        updated.displayname = value;
        // Auto-generate token name
        updated.tokenName = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
      } else if (field.startsWith('theme.')) {
        const themeField = field.replace('theme.', '');
        updated.theme =
          themeField === 'primaryColor'
            ? {
                ...updated.theme,
                primaryColor: value,
                gradientStart: value,
                gradientMiddle: value,
                gradientEnd: value,
              }
            : { ...updated.theme, [themeField]: value };

        // Apply live preview
        if (themeField === 'primaryColor') {
          document.documentElement.style.setProperty('--gradient-start', value);
          document.documentElement.style.setProperty('--gradient-middle', value);
          document.documentElement.style.setProperty('--gradient-end', value);
          // Apply primary color only if no background image/logo is active
          if (!formData.background_use_image && !formData.logo_use_background) {
          document.body.style.background = value;
            document.body.style.backgroundImage = 'none';
          }
          // Dispatch event to update halo
          window.dispatchEvent(new CustomEvent('primaryColorChange', { detail: { color: value } }));
        } else if (themeField === 'accentColor') {
          setAccentColorCssVars(value);
          const headerElement = document.querySelector('h1');
          if (headerElement) {
            headerElement.style.color = value;
          }
        } else if (themeField === 'fontFamily') {
          document.body.style.fontFamily = value;
          const headerElement = document.querySelector('h1');
          if (headerElement) {
            headerElement.style.fontFamily = value;
          }
        } else if (themeField === 'stardust') {
          onStardustPreviewChange?.(value === true);
        }
      } else if (field === 'logo_use_background' || field === 'background_use_image') {
        // Handle logo/background checkboxes with mutual exclusivity
        const newValue = value as boolean;
        const otherFieldValue = field === 'background_use_image' 
          ? formData.logo_use_background 
          : formData.background_use_image;
        
        if (field === 'logo_use_background') {
          updated.logo_use_background = newValue;
          updated.background_use_image = newValue ? false : formData.background_use_image;
        } else {
          updated.background_use_image = newValue;
          updated.logo_use_background = newValue ? false : formData.logo_use_background;
        }
        
        // Apply live preview with precedence
        setTimeout(() => {
          if (field === 'background_use_image') {
            if (newValue && backgroundPreview) {
              document.body.style.backgroundImage = `url(${backgroundPreview})`;
              document.body.style.backgroundSize = 'cover';
              document.body.style.backgroundPosition = 'center';
              document.body.style.backgroundRepeat = 'no-repeat';
            } else if (otherFieldValue && logoPreview) {
              document.body.style.backgroundImage = `url(${logoPreview})`;
              document.body.style.backgroundSize = 'cover';
              document.body.style.backgroundPosition = 'center';
              document.body.style.backgroundRepeat = 'no-repeat';
            } else {
              document.body.style.backgroundImage = 'none';
              document.body.style.background = updated.theme.primaryColor;
            }
          } else if (field === 'logo_use_background') {
            if (otherFieldValue && backgroundPreview) {
              document.body.style.backgroundImage = `url(${backgroundPreview})`;
              document.body.style.backgroundSize = 'cover';
              document.body.style.backgroundPosition = 'center';
              document.body.style.backgroundRepeat = 'no-repeat';
            } else if (newValue && logoPreview) {
              document.body.style.backgroundImage = `url(${logoPreview})`;
              document.body.style.backgroundSize = 'cover';
              document.body.style.backgroundPosition = 'center';
              document.body.style.backgroundRepeat = 'no-repeat';
            } else {
              document.body.style.backgroundImage = 'none';
              document.body.style.background = updated.theme.primaryColor;
            }
          }
        }, 0);
      } else {
        (updated as any)[field] = value;
      }
      
      return updated;
    });
  }, [onArtistNameChange, formData.background_use_image, formData.logo_use_background, backgroundPreview, logoPreview, onStardustPreviewChange]);

  const applyPrimaryPreset = useCallback((presetKey: string) => {
    const preset = COLOR_PRESETS[presetKey as keyof typeof COLOR_PRESETS];
    if (preset) {
      handleFieldChange('theme.primaryColor', preset.primary);
      handleFieldChange('theme.gradientStart', preset.primary);
      handleFieldChange('theme.gradientMiddle', preset.primary);
      handleFieldChange('theme.gradientEnd', preset.primary);
    }
  }, [handleFieldChange]);

  const applyAccentPreset = useCallback((presetKey: string) => {
    const preset = COLOR_PRESETS[presetKey as keyof typeof COLOR_PRESETS];
    if (preset) {
      handleFieldChange('theme.accentColor', preset.accent);
    }
  }, [handleFieldChange]);

  const handleSave = useCallback(() => {
    const videosrcResolved =
      typeof formData.videosrc === 'string' && formData.videosrc.trim()
        ? formData.videosrc.trim()
        : 'assets/placeholder.mp4';

    const completeData = {
      ...formData,
      id: formData.tokenName.toLowerCase(),
      name: formData.tokenName, // Required for Supabase
      videosrc: videosrcResolved,
      orbitaltokens: [],
      paused: false,
      // Logo/background files (will be uploaded after artist creation)
      logoFile: logoFile,
      backgroundFile: backgroundFile,
      // Auto-generate missing fields
      contract: null, // Will be set after deployment
      swap_address: null, // Will be set after deployment  
      download_address: null // Will be set after deployment
    };
    
    console.log('Complete artist data for deployment:', completeData);
    onSave(completeData);
  }, [formData, logoFile, backgroundFile, onSave]);

  const treasureDraftDirty = useMemo(() => {
    if (!committedTreasureSnapshot) return false;
    const s = committedTreasureSnapshot;
    if (treasureDraftCoinPublicId !== s.coinPublicId) return true;
    if (!s.coinPublicId && treasureDraftReservedEmail.trim() !== s.reservedEmail.trim()) return true;
    return JSON.stringify(formData) !== JSON.stringify(s.form);
  }, [
    committedTreasureSnapshot,
    formData,
    treasureDraftCoinPublicId,
    treasureDraftReservedEmail,
  ]);

  const treasureDraftHttpsChangedVsSnapshot = useMemo(() => {
    if (!committedTreasureSnapshot || !treasureDraftDirty) return false;
    const s = committedTreasureSnapshot.form;
    return ['logo_url', 'background_image_url', 'featured_asset_url'].some((key) => {
      const cur = formData[key as keyof InviteDraftFormInput];
      const was = s[key as keyof InviteDraftFormInput];
      return typeof cur === 'string' && cur.startsWith('https://') && cur !== was;
    });
  }, [committedTreasureSnapshot, formData, treasureDraftDirty]);

  /** Admin treasure drafts only: POST draft-upload and merge HTTPS URL into formData + previews. */
  const uploadTreasureDraftMedia = useCallback(
    async (kind: 'logo' | 'background', file: File): Promise<boolean> => {
      const coinId = treasureDraftCoinPublicId?.trim();
      if (!coinId || !getDidToken) return false;

      setTreasureBusy('upload');
      try {
        const result = await postInviteDraftUpload(getDidToken, coinId, kind, file);
        if (!result.ok) {
          showToast(result.error, 'error');
          return false;
        }
        const url = result.url;

        if (kind === 'logo') {
          setFormData((prev) => ({ ...prev, logo_url: url }));
          setLogoPreview((prev) => {
            if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
            return url;
          });
        } else {
          setFormData((prev) => ({ ...prev, background_image_url: url }));
          setBackgroundPreview((prev) => {
            if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
            return url;
          });
        }

        showToast(
          `${kind === 'logo' ? 'Logo' : 'Background'} staged — Save Treasure Draft to commit.`,
          'info',
        );
        return true;
      } finally {
        setTreasureBusy('idle');
      }
    },
    [getDidToken, showToast, treasureDraftCoinPublicId],
  );

  const uploadFeaturedViaDraft = useCallback(
    async (file: File): Promise<boolean> => {
      const coinId = treasureDraftCoinPublicId?.trim();
      if (!coinId || !getDidToken) return false;

      setTreasureBusy('upload');
      try {
        const result = await postInviteDraftUpload(getDidToken, coinId, 'featured', file);
        if (!result.ok) {
          showToast(result.error, 'error');
          return false;
        }
        const url = result.url;

        setFormData((prev) => ({ ...prev, featured_asset_url: url }));
        onWorkshopFeaturedHttpsChange?.(url);
        showToast('Featured asset staged — Save Treasure Draft to commit.', 'info');
        return true;
      } finally {
        setTreasureBusy('idle');
      }
    },
    [getDidToken, onWorkshopFeaturedHttpsChange, showToast, treasureDraftCoinPublicId],
  );

  const clearWorkshopFeatured = useCallback(() => {
    setFormData((prev) => ({ ...prev, featured_asset_url: null }));
    onWorkshopFeaturedHttpsChange?.(null);
  }, [onWorkshopFeaturedHttpsChange]);

  useEffect(() => {
    if (mode !== 'onboarding') {
      onTreasureDraftCoinPublicIdChange?.(null);
      return;
    }
    const bridgeCoin =
      typeof inviteLaunchCoinPublicId === 'string' ? inviteLaunchCoinPublicId.trim() : '';
    if (bridgeCoin) {
      onTreasureDraftCoinPublicIdChange?.(bridgeCoin);
      return;
    }
    if (isAdmin) {
      onTreasureDraftCoinPublicIdChange?.(treasureDraftCoinPublicId);
      return;
    }
    onTreasureDraftCoinPublicIdChange?.(treasureDraftCoinPublicId ?? null);
  }, [
    isAdmin,
    mode,
    treasureDraftCoinPublicId,
    inviteLaunchCoinPublicId,
    onTreasureDraftCoinPublicIdChange,
  ]);

  const inviteHandoffCoinActive =
    typeof inviteLaunchCoinPublicId === 'string' && !!inviteLaunchCoinPublicId.trim();

  useEffect(() => {
    if (
      !onRegisterWorkshopFeaturedHandlers ||
      mode !== 'onboarding' ||
      !getDidToken ||
      !(isAdmin || inviteHandoffCoinActive)
    ) {
      onRegisterWorkshopFeaturedHandlers?.(null);
      return;
    }
    onRegisterWorkshopFeaturedHandlers({
      uploadFeatured: uploadFeaturedViaDraft,
      clearFeatured: clearWorkshopFeatured,
    });
    return () => {
      onRegisterWorkshopFeaturedHandlers?.(null);
    };
  }, [
    clearWorkshopFeatured,
    getDidToken,
    inviteHandoffCoinActive,
    isAdmin,
    mode,
    onRegisterWorkshopFeaturedHandlers,
    uploadFeaturedViaDraft,
  ]);

  const loadTreasureDraftByCoinId = useCallback(
    async (coinRawInput: string) => {
      const coinRaw = coinRawInput.trim();
      if (!coinRaw) {
        showToast('Enter coin_public_id', 'error');
        return;
      }
      if (!getDidToken) {
        showToast('Wallet not configured', 'error');
        return;
      }
      setTreasureBusy('load');
      try {
        const token = await getDidToken();
        if (!token) {
          showToast('Sign in required', 'error');
          return;
        }

        const res = await fetch(`/api/invite/admin-draft?coin=${encodeURIComponent(coinRaw)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json().catch(() => ({}));

        if (res.status === 409) {
          const st = typeof data.status === 'string' ? data.status : 'non-draft';
          showToast(`${st}: ${data.error || 'not a draft invite'}`, 'error');
          return;
        }

        if (!res.ok) {
          showToast(typeof data.error === 'string' ? data.error : `Load failed (${res.status})`, 'error');
          return;
        }

        const slug = typeof data.artist_slug === 'string' ? data.artist_slug : '';
        const coin = typeof data.coin_public_id === 'string' ? data.coin_public_id : coinRaw;

        const draftPayload =
          data.draft_payload && typeof data.draft_payload === 'object'
            ? (data.draft_payload as Record<string, unknown>)
            : {};

        const base = createInviteFormBaseline(mode, ea);
        const merged = applyInviteDraftPayloadToForm(base, draftPayload);
        setFormData(merged);
        const dn = merged.displayname?.trim?.() || merged.tokenName?.trim?.() || '';
        if (dn) onArtistNameChange(dn);

        setTreasureDraftCoinPublicId(coin);
        setLoadTreasureDraftCoinQuery(coin);
        if (slug && coin) {
          setTreasureDraftTreasureUrl(clientTreasureUrlForInvite(slug, coin));
        } else if (coin) {
          setTreasureDraftTreasureUrl(null);
        }

        setLogoPreview((prev) => {
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
          if (merged.logo_url?.startsWith('https://')) return merged.logo_url;
          return merged.logo_url === null ? null : prev;
        });
        setBackgroundPreview((prev) => {
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
          if (merged.background_image_url?.startsWith('https://')) return merged.background_image_url;
          return merged.background_image_url === null ? null : prev;
        });

        setCommittedTreasureSnapshot({
          form: cloneInviteDraftForm(merged),
          coinPublicId: coin,
          reservedEmail: '',
        });

        if (mode === 'onboarding') {
          applyWorkshopVisualsFromInviteDraftForm(merged);
        }

        if (isAdmin) {
          onWorkshopFeaturedHttpsChange?.(
            merged.featured_asset_url?.startsWith('https://') ? merged.featured_asset_url : null,
          );
        }

        showToast(`Loaded draft ${coin}`, 'success');
      } catch {
        showToast('Load draft failed', 'error');
      } finally {
        setTreasureBusy('idle');
      }
    },
    [ea, getDidToken, isAdmin, mode, onArtistNameChange, onWorkshopFeaturedHttpsChange, showToast],
  );

  useEffect(() => {
    if (!onRegisterLoadTreasureDraftByCoin) return;
    onRegisterLoadTreasureDraftByCoin(loadTreasureDraftByCoinId);
  }, [onRegisterLoadTreasureDraftByCoin, loadTreasureDraftByCoinId]);

  const handleLoadTreasureDraft = useCallback(async () => {
    await loadTreasureDraftByCoinId(loadTreasureDraftCoinQuery.trim());
  }, [loadTreasureDraftByCoinId, loadTreasureDraftCoinQuery]);

  const handleRevertTreasureDraft = useCallback(() => {
    onClearWorkshopHeroStaging?.();

    if (!committedTreasureSnapshot) {
      setFormData(createInviteFormBaseline(mode, ea));
      setTreasureDraftCoinPublicId(null);
      setTreasureDraftReservedEmail('');
      setLoadTreasureDraftCoinQuery('');
      setTreasureDraftTreasureUrl(null);
      if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
      if (backgroundPreview?.startsWith('blob:')) URL.revokeObjectURL(backgroundPreview);
      setLogoPreview(null);
      setBackgroundPreview(null);
      setLogoFile(null);
      setBackgroundFile(null);
      onArtistNameChange('WELCOME, ARTIST!');
      onWorkshopFeaturedHttpsChange?.(null);
      showToast('Treasure workshop cleared to defaults.', 'info');
      return;
    }
    const s = committedTreasureSnapshot;
    const rest = cloneInviteDraftForm(s.form);
    setFormData(rest);
    setTreasureDraftCoinPublicId(s.coinPublicId);
    setTreasureDraftReservedEmail(s.reservedEmail);
    setLogoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      if (rest.logo_url?.startsWith('https://')) return rest.logo_url;
      return null;
    });
    setBackgroundPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      if (rest.background_image_url?.startsWith('https://')) return rest.background_image_url;
      return null;
    });

    if (s.coinPublicId && rest.displayname.trim()) {
      try {
        const slugGuess = clientSlugFromDisplayName(rest.displayname);
        setTreasureDraftTreasureUrl(clientTreasureUrlForInvite(slugGuess, s.coinPublicId));
      } catch {
        setTreasureDraftTreasureUrl(null);
      }
    } else {
      setTreasureDraftTreasureUrl(null);
    }

    const nm = rest.displayname?.trim?.() || rest.tokenName?.trim?.() || '';
    onArtistNameChange(nm.trim() ? nm : 'WELCOME, ARTIST!');

    onWorkshopFeaturedHttpsChange?.(
      rest.featured_asset_url?.startsWith('https://') ? rest.featured_asset_url : null,
    );

    showToast('Reverted to last committed treasure draft.', 'info');
  }, [
    backgroundPreview,
    committedTreasureSnapshot,
    ea,
    logoPreview,
    mode,
    onArtistNameChange,
    onClearWorkshopHeroStaging,
    onWorkshopFeaturedHttpsChange,
    showToast,
  ]);

  const handleSaveTreasureDraft = useCallback(async () => {
    if (!formData.displayname.trim() || !formData.tokenName.trim()) {
      showToast('Display name and token symbol are required', 'error');
      return;
    }
    const coinTrim = treasureDraftCoinPublicId?.trim() || null;
    if (!coinTrim && !treasureDraftReservedEmail.trim()) {
      showToast('Reserved email required to create the first draft', 'error');
      return;
    }
    if (!getDidToken) {
      showToast('Wallet not configured', 'error');
      return;
    }

    const formAtClick = cloneInviteDraftForm(formData);
    let workingForm = formAtClick;

    setTreasureBusy('save');
    try {
      const token = await getDidToken();
      if (!token) {
        showToast('Sign in required', 'error');
        return;
      }

      const draft_payload_primary = buildInviteDraftPayloadV1(workingForm);
      const bodyObj: Record<string, unknown> = { draft_payload: draft_payload_primary };
      if (coinTrim) bodyObj.coin_public_id = coinTrim;
      else bodyObj.reserved_email = treasureDraftReservedEmail.trim();

      const res = await fetch('/api/invite/save-draft', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyObj),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(
          typeof data.error === 'string'
            ? data.error
            : `${typeof data.message === 'string' ? data.message : 'Save draft failed'} (${res.status})`,
          'error',
        );
        return;
      }

      const nextCoinRaw =
        typeof data.coin_public_id === 'string' ? data.coin_public_id : coinTrim ?? null;
      const nextCoin = typeof nextCoinRaw === 'string' ? nextCoinRaw.trim() || null : null;
      const tu = typeof data.treasure_url === 'string' ? data.treasure_url : '';

      const flushEligible =
        isAdmin &&
        mode === 'onboarding' &&
        typeof getDidToken === 'function' &&
        Boolean(nextCoin);

      const coin = nextCoin?.trim() ?? '';
      const hadFlushAttempt =
        flushEligible &&
        Boolean(coin) &&
        (Boolean(logoFile && !isDraftMediaHttps(formAtClick.logo_url)) ||
          Boolean(backgroundFile && !isDraftMediaHttps(formAtClick.background_image_url)) ||
          Boolean(uploadedFile && !isDraftMediaHttps(formAtClick.featured_asset_url)));

      const failures: string[] = [];
      let anyUploadSuccess = false;
      let didAttemptSecondSave = false;
      let secondSaveOk = true;

      if (flushEligible && coin) {
        const pendingLogo = Boolean(logoFile && !isDraftMediaHttps(workingForm.logo_url));
        const pendingBg = Boolean(backgroundFile && !isDraftMediaHttps(workingForm.background_image_url));
        const pendingFeatured = Boolean(uploadedFile && !isDraftMediaHttps(workingForm.featured_asset_url));

        if (pendingLogo && logoFile) {
          const r = await postInviteDraftUpload(getDidToken, coin, 'logo', logoFile);
          if (r.ok) {
            workingForm = { ...workingForm, logo_url: r.url };
            anyUploadSuccess = true;
          } else failures.push(`Logo: ${r.error}`);
        }

        if (pendingBg && backgroundFile) {
          const r = await postInviteDraftUpload(getDidToken, coin, 'background', backgroundFile);
          if (r.ok) {
            workingForm = { ...workingForm, background_image_url: r.url };
            anyUploadSuccess = true;
          } else failures.push(`Background: ${r.error}`);
        }

        if (pendingFeatured && uploadedFile) {
          const r = await postInviteDraftUpload(getDidToken, coin, 'featured', uploadedFile);
          if (r.ok) {
            workingForm = { ...workingForm, featured_asset_url: r.url };
            anyUploadSuccess = true;
            onWorkshopFeaturedHttpsChange?.(r.url);
            onClearWorkshopHeroStaging?.();
          } else failures.push(`Featured: ${r.error}`);
        }

        if (anyUploadSuccess) {
          didAttemptSecondSave = true;
          const draft_payload_second = buildInviteDraftPayloadV1(workingForm);
          const res2 = await fetch('/api/invite/save-draft', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              draft_payload: draft_payload_second,
              coin_public_id: coin,
            }),
          });
          const data2 = await res2.json().catch(() => ({}));
          secondSaveOk = res2.ok;
          if (!res2.ok) {
            const base =
              typeof data2.error === 'string'
                ? data2.error
                : 'Could not save media URLs to draft.';
            const extra = failures.length ? ` ${failures.join('; ')}` : '';
            showToast(`${base} Click Save Treasure Draft again.${extra}`, 'error');
          }
        }
      }

      setTreasureDraftCoinPublicId(nextCoin);
      if (tu) setTreasureDraftTreasureUrl(tu);

      setFormData(workingForm);

      setLogoPreview((prev) => {
        if (isDraftMediaHttps(workingForm.logo_url)) {
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
          return workingForm.logo_url!;
        }
        return prev;
      });
      setBackgroundPreview((prev) => {
        if (isDraftMediaHttps(workingForm.background_image_url)) {
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
          return workingForm.background_image_url!;
        }
        return prev;
      });

      if (mode === 'onboarding' && flushEligible && anyUploadSuccess) {
        applyWorkshopVisualsFromInviteDraftForm(workingForm);
      }

      const committedForm =
        didAttemptSecondSave && !secondSaveOk ? formAtClick : cloneInviteDraftForm(workingForm);

      setCommittedTreasureSnapshot({
        form: committedForm,
        coinPublicId: nextCoin,
        reservedEmail: nextCoin ? '' : treasureDraftReservedEmail.trim(),
      });

      if (didAttemptSecondSave && !secondSaveOk) {
        /* second-save error toast already shown */
      } else if (failures.length > 0 && anyUploadSuccess && secondSaveOk) {
        showToast(
          `Treasure draft saved. Some media failed: ${failures.join('; ')}. Click Save Treasure Draft again to retry.`,
          'info',
        );
      } else if (failures.length > 0 && !anyUploadSuccess && hadFlushAttempt) {
        showToast(
          `Draft saved but media upload failed: ${failures.join('; ')}. Click Save Treasure Draft again to retry.`,
          'error',
        );
      } else if (
        failures.length === 0 &&
        (!didAttemptSecondSave || secondSaveOk)
      ) {
        showToast(`Treasure draft saved${nextCoin ? ` (${nextCoin})` : ''}`, 'success');
      }
    } catch {
      showToast('Save draft failed', 'error');
    } finally {
      setTreasureBusy('idle');
    }
  }, [
    backgroundFile,
    formData,
    getDidToken,
    isAdmin,
    logoFile,
    mode,
    onClearWorkshopHeroStaging,
    onWorkshopFeaturedHttpsChange,
    showToast,
    treasureDraftCoinPublicId,
    treasureDraftReservedEmail,
    uploadedFile,
  ]);

  const copyTreasureDraftText = useCallback(
    async (label: string, text: string) => {
      if (!text) {
        showToast(`No ${label} to copy`, 'error');
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        showToast(`${label} copied`, 'success');
      } catch {
        showToast(`${label}: copy blocked — select and copy manually`, 'error');
      }
    },
    [showToast],
  );

  return (
    <div className="swap-panel-halo-wrap swap-panel-halo-wrap--linen max-w-2xl mx-auto mt-8">
    <div className="onboarding-panel swap-panel-glimmer p-4 md:p-6 shadow-xl rounded-lg border border-gray-700 backdrop-blur-md overflow-x-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6 gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-white" style={{ fontFamily: 'Bungee, cursive', color: mode === 'upload-asset' ? (existingArtist?.theme?.accentColor || '#B8860B') : '#B8860B' }}>
          {mode === 'upload-asset' ? 'UPLOAD NEW ASSET' : 'CREATE ARTIST'}
        </h2>
        <button
          onClick={onExit}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {isAdmin && mode === 'onboarding' && getDidToken && (
        <div className="mb-6 rounded-lg border border-amber-500/50 bg-amber-950/40 p-4 space-y-3">
            <h3 className="text-lg font-semibold text-amber-200">Treasure draft (admin)</h3>

            {(treasureDraftDirty || treasureDraftHttpsChangedVsSnapshot) && (
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-semibold uppercase tracking-wide text-amber-400">
                  Unsaved changes
                </span>
                {treasureDraftHttpsChangedVsSnapshot ? (
                  <span className="text-amber-100/90">
                    Media uploaded to preview — click Save Treasure Draft to write URLs into{' '}
                    <code className="text-amber-200">draft_payload</code>.
                  </span>
                ) : (
                  <span className="text-amber-100/70">Form differs from last saved / loaded snapshot.</span>
                )}
              </div>
            )}

            <div className="grid gap-2 text-sm">
              <label className="text-gray-300">
                Reserved email (first create only — claim target)
              </label>
              <input
                type="email"
                placeholder="collector@..."
                disabled={Boolean(treasureDraftCoinPublicId)}
                value={treasureDraftReservedEmail}
                onChange={(e) => setTreasureDraftReservedEmail(e.target.value)}
                className="w-full p-2 bg-gray-800 text-white rounded border border-gray-600 disabled:opacity-50"
              />

              <div className="flex gap-2 items-end flex-wrap mt-2">
                <input
                  type="text"
                  placeholder="coin_public_id to load draft"
                  value={loadTreasureDraftCoinQuery}
                  onChange={(e) => setLoadTreasureDraftCoinQuery(e.target.value)}
                  className="flex-1 min-w-[10rem] p-2 bg-gray-800 text-white rounded border border-gray-600"
                />
                <button
                  type="button"
                  disabled={treasureBusy !== 'idle'}
                  onClick={handleLoadTreasureDraft}
                  className="px-3 py-2 bg-blue-700 text-white rounded hover:bg-blue-600 disabled:opacity-50 whitespace-nowrap"
                >
                  {treasureBusy === 'load' ? 'Loading…' : 'Load draft'}
                </button>
              </div>
            </div>

            {(treasureDraftCoinPublicId || treasureDraftTreasureUrl) && (
              <div className="rounded bg-gray-900/60 border border-gray-700 p-3 text-xs font-mono break-all space-y-2">
                {treasureDraftCoinPublicId && (
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                    <span className="text-gray-400 shrink-0 mr-2">coin_public_id</span>
                    <span className="text-white mr-auto">{treasureDraftCoinPublicId}</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyTreasureDraftText('coin_public_id', treasureDraftCoinPublicId)
                      }
                      className="text-amber-300 hover:text-amber-100 whitespace-nowrap"
                    >
                      Copy
                    </button>
                  </div>
                )}
                {treasureDraftTreasureUrl && (
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                    <span className="text-gray-400 shrink-0 mr-2">treasure_url</span>
                    <span className="text-white mr-auto">{treasureDraftTreasureUrl}</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyTreasureDraftText('treasure URL', treasureDraftTreasureUrl)
                      }
                      className="text-amber-300 hover:text-amber-100 whitespace-nowrap"
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-gray-400">
              Previews work immediately (same as normal onboarding). After the first Save creates a{' '}
              <code className="text-amber-200/90">coin_public_id</code>, uploads also stage HTTPS URLs so{' '}
              Save Treasure Draft can persist media in <code className="text-amber-200/90">draft_payload</code>.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={treasureBusy !== 'idle'}
                onClick={handleSaveTreasureDraft}
                className="flex-1 min-w-[8rem] px-4 py-2 bg-emerald-700 text-white font-semibold rounded hover:bg-emerald-600 disabled:opacity-50"
              >
                {treasureBusy === 'save' ? 'Saving…' : 'Save Treasure Draft'}
              </button>
              <button
                type="button"
                disabled={treasureBusy !== 'idle'}
                onClick={handleRevertTreasureDraft}
                className="px-4 py-2 bg-gray-700 text-white rounded border border-gray-500 hover:bg-gray-600 disabled:opacity-50"
              >
                Revert
              </button>
            </div>
          </div>
      )}

      {/* Artist Identity Section - Only show for new artists */}
      {mode === 'onboarding' && (
      <div className="swap-silver-bar mb-6">
        <div className="swap-silver-bar-row">
          <label className="swap-silver-bar-label">Artist Name</label>
          <input
            type="text"
            value={formData.displayname}
            onChange={(e) => {
              const value = e.target.value;
              handleFieldChange('displayname', value);
              // Real-time header update
              onArtistNameChange(value || 'WELCOME, ARTIST!');
            }}
            placeholder="e.g., DJ Nova"
            className="swap-silver-bar-input w-full p-3 rounded-md"
            autoFocus
          />
        </div>
        <div className="swap-silver-bar-divider" aria-hidden="true" />
        <div className="swap-silver-bar-row">
          <label className="swap-silver-bar-label">Token Symbol</label>
          <input
            type="text"
            value={formData.tokenName}
            onChange={(e) => handleFieldChange('tokenName', e.target.value.toUpperCase().substring(0, 8))}
            placeholder="e.g., DJNOVA"
            maxLength={8}
            className="swap-silver-bar-input w-full p-3 rounded-md"
          />
          <div className="text-xs text-gray-400 mt-1">Max 8 characters • ERC-20 token price set by market</div>
        </div>
      </div>
      )}

      {/* Typography Section - Only show for new artists */}
      {mode === 'onboarding' && (
      <div
        className="mb-6"
        style={{ zIndex: fontDropdownOpen ? 100 : undefined }}
      >
        <h3 className="text-lg font-semibold text-white mb-3">Typography</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {FONT_OPTIONS.map((font) => (
            <button
              key={font.value}
              onClick={() => handleFieldChange('theme.fontFamily', font.value)}
              className={`p-3 rounded-lg border-2 transition-all ${
                formData.theme.fontFamily === font.value
                  ? 'border-yellow-500 bg-yellow-500 bg-opacity-20'
                  : 'border-gray-600 bg-gray-700 hover:border-gray-500'
              }`}
              style={{ fontFamily: font.value }}
            >
              <div className="text-white font-bold text-sm">{font.name}</div>
            </button>
          ))}
        </div>

        {/* Font Dropdown (same behavior as ProfileEditPanel) */}
        <div className="relative mt-4">
          <label className="block text-sm text-gray-300 mb-2">Or choose from common fonts:</label>
          <FontDropdownOnboarding
            current={formData.theme.fontFamily}
            onOpenChange={setFontDropdownOpen}
            onSelect={(font) => {
              handleFieldChange('theme.fontFamily', font);
            }}
          />
        </div>
      </div>
      )}

      {/* Primary Color Section - Only show for new artists */}
      {mode === 'onboarding' && (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Primary Color (Background)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
            <button
              key={`primary-${key}`}
              onClick={() => applyPrimaryPreset(key)}
              className={`relative w-12 h-12 rounded-lg border-2 transition-all hover:scale-110 ${
                formData.theme.primaryColor === preset.primary
                  ? 'border-white'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: preset.primary }}
              title={`${preset.name} Primary`}
            >
              {formData.theme.primaryColor === preset.primary && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2">
          <input
            type="color"
            value={formData.theme.primaryColor}
            onChange={(e) => handleFieldChange('theme.primaryColor', e.target.value)}
            className="w-10 h-10 rounded border border-gray-600"
          />
          <input
            type="text"
            value={formData.theme.primaryColor}
            onChange={(e) => handleFieldChange('theme.primaryColor', e.target.value)}
            className="flex-1 p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
            placeholder="#RRGGBB"
          />
        </div>
      </div>
      )}

      {/* Accent Color Section - Only show for new artists */}
      {mode === 'onboarding' && (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Accent Color (Text/Highlights)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
            <button
              key={`accent-${key}`}
              onClick={() => applyAccentPreset(key)}
              className={`relative w-12 h-12 rounded-lg border-2 transition-all hover:scale-110 ${
                formData.theme.accentColor === preset.accent
                  ? 'border-white'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: preset.accent }}
              title={`${preset.name} Accent`}
            >
              {formData.theme.accentColor === preset.accent && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2">
          <input
            type="color"
            value={formData.theme.accentColor}
            onChange={(e) => handleFieldChange('theme.accentColor', e.target.value)}
            className="w-10 h-10 rounded border border-gray-600"
          />
          <input
            type="text"
            value={formData.theme.accentColor}
            onChange={(e) => handleFieldChange('theme.accentColor', e.target.value)}
            className="flex-1 p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
            placeholder="#RRGGBB"
          />
        </div>
      </div>
      )}

      {/* Stardust atmosphere — only for new artists */}
      {mode === 'onboarding' && (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Atmosphere</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            id="themeStardust"
            type="checkbox"
            checked={formData.theme.stardust === true}
            onChange={(e) => handleFieldChange('theme.stardust', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-accentColor focus:ring-accentColor"
          />
          <span className="text-sm text-gray-200">Stardust</span>
        </label>
        <p className="text-xs text-gray-400 mt-2 ml-7">
          Floating starfield behind your portal. Off by default — check to enable.
        </p>
      </div>
      )}

      {/* Logo Upload Section - Only show for new artists */}
      {mode === 'onboarding' && (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Logo Upload</h3>
        
        {/* Current logo preview */}
        {logoPreview && (
          <div className="mb-3 relative">
            <button
              onClick={() => {
                if (logoPreview.startsWith('blob:')) {
                  URL.revokeObjectURL(logoPreview);
                }
                setLogoPreview(null);
                setLogoFile(null);
                setFormData(prev => ({
                  ...prev,
                  logo_url: null,
                  logo_use_background: false
                }));
                // Revert background
                setTimeout(() => {
                  if (formData.background_use_image && backgroundPreview) {
                    document.body.style.backgroundImage = `url(${backgroundPreview})`;
                  } else {
                    document.body.style.backgroundImage = 'none';
                    document.body.style.background = formData.theme.primaryColor;
                  }
                  document.body.style.backgroundSize = 'cover';
                  document.body.style.backgroundPosition = 'center';
                  document.body.style.backgroundRepeat = 'no-repeat';
                }, 0);
              }}
              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold transition-colors shadow-lg z-10"
              title="Remove logo"
            >
              ×
            </button>
            <img 
              src={logoPreview} 
              alt="Logo preview" 
              className="w-full h-64 object-contain rounded border border-gray-600 bg-gray-800"
            />
          </div>
        )}
        
        {/* File input */}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
              alert('Please upload an image file (JPG, PNG, SVG, or WebP)');
              return;
            }

            if (file.size > 5 * 1024 * 1024) {
              alert('File size must be less than 5MB');
              return;
            }

            const adminTreasureMedia =
              isAdmin && mode === 'onboarding' && Boolean(getDidToken);

            if (adminTreasureMedia) {
              setLogoFile(file);
              if (logoPreview && logoPreview.startsWith('blob:')) {
                URL.revokeObjectURL(logoPreview);
              }
              const preview = URL.createObjectURL(file);
              setLogoPreview(preview);
              setFormData((prev) => ({ ...prev, logo_url: preview }));
              if (formData.logo_use_background) {
                setTimeout(() => {
                  document.body.style.backgroundImage = `url(${preview})`;
                  document.body.style.backgroundSize = 'cover';
                  document.body.style.backgroundPosition = 'center';
                  document.body.style.backgroundRepeat = 'no-repeat';
                }, 0);
              }
              if (treasureDraftCoinPublicId?.trim()) {
                void uploadTreasureDraftMedia('logo', file).then((ok) => {
                  if (!ok) {
                    setLogoPreview((p) => {
                      if (p?.startsWith('blob:')) URL.revokeObjectURL(p);
                      return null;
                    });
                    setLogoFile(null);
                    setFormData((prev) => ({ ...prev, logo_url: null }));
                  }
                });
              }
              e.target.value = '';
              return;
            }

            setLogoFile(file);
            if (logoPreview && logoPreview.startsWith('blob:')) {
              URL.revokeObjectURL(logoPreview);
            }
            const preview = URL.createObjectURL(file);
            setLogoPreview(preview);
            setFormData((prev) => ({ ...prev, logo_url: preview }));

            if (formData.logo_use_background) {
              setTimeout(() => {
                document.body.style.backgroundImage = `url(${preview})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundRepeat = 'no-repeat';
              }, 0);
            }
          }}
          className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 mb-3 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-500 file:text-white hover:file:bg-yellow-600"
        />
        
        {/* Checkbox - Use logo as background */}
        <label className="flex items-center text-white cursor-pointer">
          <input
            type="checkbox"
            checked={formData.logo_use_background}
            onChange={(e) => {
              const checked = e.target.checked;
              setFormData(prev => {
                const updated = {
                  ...prev,
                  logo_use_background: checked,
                  background_use_image: checked ? false : prev.background_use_image
                };
                // Apply live preview
                setTimeout(() => {
                  if (checked && logoPreview) {
                    document.body.style.backgroundImage = `url(${logoPreview})`;
                    document.body.style.backgroundSize = 'cover';
                    document.body.style.backgroundPosition = 'center';
                    document.body.style.backgroundRepeat = 'no-repeat';
                  } else if (!checked && updated.background_use_image && backgroundPreview) {
                    document.body.style.backgroundImage = `url(${backgroundPreview})`;
                    document.body.style.backgroundSize = 'cover';
                    document.body.style.backgroundPosition = 'center';
                    document.body.style.backgroundRepeat = 'no-repeat';
                  } else {
                    document.body.style.backgroundImage = 'none';
                    document.body.style.background = updated.theme.primaryColor;
                  }
                }, 0);
                return updated;
              });
            }}
            className="mr-2 w-4 h-4"
            disabled={!logoPreview}
          />
          <span className={logoPreview ? '' : 'text-gray-500'}>
            Use logo as page background
          </span>
        </label>
      </div>
      )}

      {/* Background Image Section - Only show for new artists */}
      {mode === 'onboarding' && (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Background Image</h3>
        
        {/* Current background preview */}
        {backgroundPreview && (
          <div className="mb-3 relative">
            <button
              onClick={() => {
                if (backgroundPreview.startsWith('blob:')) {
                  URL.revokeObjectURL(backgroundPreview);
                }
                setBackgroundPreview(null);
                setBackgroundFile(null);
                setFormData(prev => ({
                  ...prev,
                  background_image_url: null,
                  background_use_image: false
                }));
                // Revert background
                setTimeout(() => {
                  if (formData.logo_use_background && logoPreview) {
                    document.body.style.backgroundImage = `url(${logoPreview})`;
                  } else {
                    document.body.style.backgroundImage = 'none';
                    document.body.style.background = formData.theme.primaryColor;
                  }
                  document.body.style.backgroundSize = 'cover';
                  document.body.style.backgroundPosition = 'center';
                  document.body.style.backgroundRepeat = 'no-repeat';
                }, 0);
              }}
              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold transition-colors shadow-lg z-10"
              title="Remove background image"
            >
              ×
            </button>
            <img 
              src={backgroundPreview} 
              alt="Background preview" 
              className="w-full h-64 object-contain rounded border border-gray-600 bg-gray-800"
            />
          </div>
        )}
        
        {/* File input */}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
              alert('Please upload an image file (JPG, PNG, SVG, or WebP)');
              return;
            }
            if (file.size > 5 * 1024 * 1024) {
              alert('File size must be less than 5MB');
              return;
            }

            const adminTreasureMedia =
              isAdmin && mode === 'onboarding' && Boolean(getDidToken);

            if (adminTreasureMedia) {
              setBackgroundFile(file);
              if (backgroundPreview && backgroundPreview.startsWith('blob:')) {
                URL.revokeObjectURL(backgroundPreview);
              }
              const preview = URL.createObjectURL(file);
              setBackgroundPreview(preview);
              setFormData((prev) => ({ ...prev, background_image_url: preview }));
              if (formData.background_use_image) {
                setTimeout(() => {
                  document.body.style.backgroundImage = `url(${preview})`;
                  document.body.style.backgroundSize = 'cover';
                  document.body.style.backgroundPosition = 'center';
                  document.body.style.backgroundRepeat = 'no-repeat';
                }, 0);
              }
              if (treasureDraftCoinPublicId?.trim()) {
                void uploadTreasureDraftMedia('background', file).then((ok) => {
                  if (!ok) {
                    setBackgroundPreview((p) => {
                      if (p?.startsWith('blob:')) URL.revokeObjectURL(p);
                      return null;
                    });
                    setBackgroundFile(null);
                    setFormData((prev) => ({ ...prev, background_image_url: null }));
                  }
                });
              }
              e.target.value = '';
              return;
            }

            setBackgroundFile(file);
            if (backgroundPreview && backgroundPreview.startsWith('blob:')) {
              URL.revokeObjectURL(backgroundPreview);
            }
            const preview = URL.createObjectURL(file);
            setBackgroundPreview(preview);
            setFormData((prev) => ({ ...prev, background_image_url: preview }));

            if (formData.background_use_image) {
              setTimeout(() => {
                document.body.style.backgroundImage = `url(${preview})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundRepeat = 'no-repeat';
              }, 0);
            }
          }}
          className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 mb-3 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-500 file:text-white hover:file:bg-yellow-600"
        />
        
        {/* Checkbox - Use background image */}
        <label className="flex items-center text-white cursor-pointer">
          <input
            type="checkbox"
            checked={formData.background_use_image}
            onChange={(e) => {
              const checked = e.target.checked;
              setFormData(prev => {
                const updated = {
                  ...prev,
                  background_use_image: checked,
                  logo_use_background: checked ? false : prev.logo_use_background
                };
                // Apply live preview
                setTimeout(() => {
                  if (checked && backgroundPreview) {
                    document.body.style.backgroundImage = `url(${backgroundPreview})`;
                    document.body.style.backgroundSize = 'cover';
                    document.body.style.backgroundPosition = 'center';
                    document.body.style.backgroundRepeat = 'no-repeat';
                  } else if (!checked && updated.logo_use_background && logoPreview) {
                    document.body.style.backgroundImage = `url(${logoPreview})`;
                    document.body.style.backgroundSize = 'cover';
                    document.body.style.backgroundPosition = 'center';
                    document.body.style.backgroundRepeat = 'no-repeat';
                  } else {
                    document.body.style.backgroundImage = 'none';
                    document.body.style.background = updated.theme.primaryColor;
                  }
                }, 0);
                return updated;
              });
            }}
            className="mr-2 w-4 h-4"
            disabled={!backgroundPreview}
          />
          <span className={backgroundPreview ? '' : 'text-gray-500'}>
            Use background image
          </span>
        </label>
      </div>
      )}

      {/* Content Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Featured Content</h3>

        <div className="swap-silver-bar mb-4">
          <div className="swap-silver-bar-row">
            <label className="swap-silver-bar-label">Content Title</label>
            <input
              type="text"
              value={formData.artworktitle}
              onChange={(e) => handleFieldChange('artworktitle', e.target.value)}
              placeholder="e.g., Cosmic Dreams #1"
              className="swap-silver-bar-input w-full p-3 rounded-md"
            />
          </div>
          <div className="swap-silver-bar-divider" aria-hidden="true" />
          <div className="swap-silver-bar-row">
            <label className="swap-silver-bar-label">Download Price (USD)</label>
            <div className="inline-flex items-center gap-1">
              <span className="text-sm text-gray-300">$</span>
              <input
                type="number"
                min="0.01"
                max="999999999"
                step="0.01"
                value={formData.downloadPrice}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 1.00;
                  const clampedValue = Math.min(Math.max(value, 0.01), 999999999);
                  handleFieldChange('downloadPrice', clampedValue);
                }}
                className="swap-silver-bar-input custom-token-input text-xl font-bold text-center w-32 p-2 rounded-md"
                style={{ fontFamily: 'inherit' }}
                placeholder="1.00"
              />
              <span className="text-sm text-gray-400 ml-1">per download</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">Click to edit • Use slider for quick adjustment</div>
          </div>
        </div>

        <div className="mb-4">
          <input
            type="range"
            min="1"
            max="10000"
            step="1"
            value={Math.min(formData.downloadPrice, 10000)}
            onChange={(e) => handleFieldChange('downloadPrice', parseFloat(e.target.value))}
            className="custom-token-slider w-full"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>$1</span>
            <span>$100</span>
            <span>$1K</span>
            <span>$5K</span>
            <span>$10K+</span>
          </div>
        </div>

        <div className="swap-silver-bar mb-4">
          <div className="swap-silver-bar-row">
            <label className="swap-silver-bar-label">
              Description
              <span className="normal-case font-normal tracking-normal text-gray-400 text-xs ml-2">
                (optional — you can edit later)
              </span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Tell collectors about this piece..."
              rows={3}
              maxLength={500}
              className="swap-silver-bar-input w-full p-3 rounded-md resize-none"
            />
            <div className="text-xs text-gray-400 mt-1 text-right">
              {formData.description.length}/500 characters
            </div>
          </div>
        </div>
        
        {/* Small upload preview in form */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">Upload Preview</label>
          {uploadedFile && filePreviewUrl ? (
            <div className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
              {/* Small thumbnail */}
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-500 flex-shrink-0">
                {uploadedFile.type.startsWith('image/') ? (
                  <img 
                    src={filePreviewUrl} 
                    alt={uploadedFile.name}
                    className="w-full h-full object-cover"
                  />
                ) : uploadedFile.type.startsWith('video/') ? (
                  <video 
                    src={filePreviewUrl} 
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-600 flex items-center justify-center">
                    <span className="text-2xl">
                      {uploadedFile.type.startsWith('audio/') ? '🎵' : '📁'}
                    </span>
                  </div>
                )}
              </div>
              
              {/* File info */}
              <div className="flex-1">
                <div className="text-white text-sm font-medium truncate">{uploadedFile.name}</div>
                <div className="text-gray-400 text-xs">
                  {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB • {uploadedFile.type}
                </div>
              </div>
              
              {/* Change button */}
              <button
                type="button"
                onClick={onUploadClick}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                Change
              </button>
            </div>
          ) : formData.featured_asset_url?.startsWith('https') ? (
            <div className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg border border-gray-600">
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-500 flex-shrink-0 bg-black/40">
                {/\.(mp4|webm|mov|ogg)(\?|$)/i.test(formData.featured_asset_url) ? (
                  <video
                    src={formData.featured_asset_url}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                ) : /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(formData.featured_asset_url) ? (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🎵</div>
                ) : (
                  <img
                    src={formData.featured_asset_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-mono truncate">{formData.featured_asset_url}</div>
                <div className="text-gray-400 text-xs mt-1">Staged featured asset — Save Treasure Draft to commit.</div>
              </div>
              <button
                type="button"
                onClick={onUploadClick}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 shrink-0"
              >
                Change
              </button>
            </div>
          ) : (
            <div 
              onClick={onUploadClick}
              className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-gray-500 transition-colors"
            >
              <div className="text-gray-400 text-sm">Click to upload or use drag & drop above</div>
            </div>
          )}
        </div>
        
        <div className="text-xs text-gray-400">
          Upload content using drag & drop above or form upload • Download price is for ERC-1155 collectibles
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleSave}
          disabled={
            (mode === 'onboarding'
              ? !formData.displayname || !formData.tokenName
              : !formData.artworktitle || !uploadedFile) ||
            (mode === 'onboarding' && artistLaunchLocksPrimaryButton)
          }
          className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-bold hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
        >
          {mode === 'upload-asset' ? '📤 UPLOAD & MINT ASSET' : '🚀 CREATE ARTIST PAGE'}
        </button>
        <button
          onClick={onExit}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors sm:flex-shrink-0"
        >
          Cancel
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="mt-4 text-center">
        <div className="text-xs text-gray-400">
          {mode === 'upload-asset' ? (
            formData.artworktitle && uploadedFile ? (
              <span className="text-green-400">✓ Ready to upload! Download price: ${formData.downloadPrice}</span>
            ) : (
              'Add content title and upload file'
            )
          ) : (
            formData.displayname && formData.tokenName ? (
              <span className="text-green-400">✓ Ready to launch! Download price: ${formData.downloadPrice}</span>
            ) : (
              'Fill in artist name and token symbol'
            )
          )}
        </div>
      </div>
    </div>
    </div>
  );
};

export default OnboardingPanel;
