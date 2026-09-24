import {
  AllAppleDeviceNames,
  combinePresetAndAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

/*
 * `npm run pwa:assets` – icons and iOS launch screens from public/pwa-icon.svg (the mint ring).
 * Everything sits on the app background, so the icon, the launch screen and the first frame of
 * the app are one dark surface (no white flash on iOS).
 */
const plate = { background: '#0B0C0F', fit: 'contain' } as const

// Recent iPhones only – the app lives on an iPhone and a MacBook, iPads are not a target.
const iPhones = AllAppleDeviceNames.filter((name) =>
  /^iPhone (1[2-7]|Air|16e)/.test(name),
)

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: combinePresetAndAppleSplashScreens(
    {
      ...minimal2023Preset,
      transparent: { ...minimal2023Preset.transparent, padding: 0.12, resizeOptions: plate },
      maskable: { ...minimal2023Preset.maskable, padding: 0.34, resizeOptions: plate },
      apple: { ...minimal2023Preset.apple, padding: 0.24, resizeOptions: plate },
    },
    {
      padding: 0.72,
      resizeOptions: plate,
      linkMediaOptions: { log: true, addMediaScreen: true, basePath: '/', xhtml: false },
    },
    iPhones,
  ),
  images: ['public/pwa-icon.svg'],
})
