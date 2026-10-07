// Export presets for common social media and print formats.
// Each preset defines the board size in pixels.

export interface ExportPreset {
  id: string
  labelKey: string
  width: number
  height: number
  category: 'social' | 'print' | 'screen'
}

export const EXPORT_PRESETS: ExportPreset[] = [
  // Social
  { id: 'ig-post', labelKey: 'preset.igPost', width: 1080, height: 1080, category: 'social' },
  { id: 'ig-portrait', labelKey: 'preset.igPortrait', width: 1080, height: 1350, category: 'social' },
  { id: 'ig-story', labelKey: 'preset.igStory', width: 1080, height: 1920, category: 'social' },
  { id: 'ig-reel', labelKey: 'preset.igReel', width: 1080, height: 1920, category: 'social' },
  { id: 'pinterest', labelKey: 'preset.pinterest', width: 1000, height: 1500, category: 'social' },
  { id: 'twitter', labelKey: 'preset.twitter', width: 1200, height: 675, category: 'social' },
  { id: 'facebook', labelKey: 'preset.facebook', width: 1200, height: 630, category: 'social' },
  { id: 'linkedin', labelKey: 'preset.linkedin', width: 1200, height: 627, category: 'social' },
  { id: 'youtube-thumb', labelKey: 'preset.youtubeThumb', width: 1280, height: 720, category: 'social' },
  { id: 'tiktok', labelKey: 'preset.tiktok', width: 1080, height: 1920, category: 'social' },
  // Print
  { id: 'a4-portrait', labelKey: 'preset.a4Portrait', width: 2480, height: 3508, category: 'print' },
  { id: 'a4-landscape', labelKey: 'preset.a4Landscape', width: 3508, height: 2480, category: 'print' },
  { id: 'letter-portrait', labelKey: 'preset.letterPortrait', width: 2550, height: 3300, category: 'print' },
  { id: 'photo-10x15', labelKey: 'preset.photo10x15', width: 1181, height: 1772, category: 'print' },
  { id: 'a5-portrait', labelKey: 'preset.a5Portrait', width: 1748, height: 2480, category: 'print' },
  { id: '4x6', labelKey: 'preset.4x6', width: 1200, height: 1800, category: 'print' },
  { id: '5x7', labelKey: 'preset.5x7', width: 1500, height: 2100, category: 'print' },
  // Screen
  { id: 'hd', labelKey: 'preset.hd', width: 1920, height: 1080, category: 'screen' },
  { id: '4k', labelKey: 'preset.4k', width: 3840, height: 2160, category: 'screen' },
  { id: 'wallpaper', labelKey: 'preset.wallpaper', width: 2560, height: 1440, category: 'screen' },
]

export const PRESET_CATEGORIES: { id: ExportPreset['category']; labelKey: string }[] = [
  { id: 'social', labelKey: 'preset.catSocial' },
  { id: 'print', labelKey: 'preset.catPrint' },
  { id: 'screen', labelKey: 'preset.catScreen' },
]

export const DEFAULT_PRESET = EXPORT_PRESETS[0]
