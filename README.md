# Loom Lingo

A personal-use Android app that turns the speech in a YouTube video into readable Turkish text. You paste a link, or share a video from the YouTube app. It was built for one older user who watches textile-machine training videos (sewing, overlock, embroidery, weaving, knitting) in English, Hindi, Bengali and other languages. The interface is in Turkish, uses large high-contrast text, and has as few screens as possible.

- **Free to run.** Gemini's free API tier, no backend, no paid services.
- **Stack:** Expo SDK 57, React Native 0.86 and TypeScript. Android only. Installed as an APK built with EAS Build, not published on Google Play.

## How it works

```
link ─► local history (cache) ─► YouTube captions ─► Gemini text translation ─► result
                                     │ none / unusable
                                     └────────────► Gemini video input (URL) ─► result
```

1. **Cache first.** A video that was already translated opens from the phone's history. No internet or API quota is used.
2. **Captions path (fast, cheap).** [services/transcript.ts](services/transcript.ts) reads the video's caption track list. It prefers a human Turkish track, then a human track in the spoken language, then any human track, then the automatic track. Caption lines are grouped into timestamped paragraphs and translated by Gemini in batches ([services/translate.ts](services/translate.ts)). Turkish tracks are shown as they are, without translation. Tracks with too little text (fewer than 60 characters per minute) are treated as unusable. A typical case is an English auto-caption on a Bengali video.
3. **Gemini video path (fallback).** [services/geminiVideo.ts](services/geminiVideo.ts) passes the public YouTube URL straight to Gemini. Gemini listens to the audio, looks at the frames, and returns the original speech and its Turkish translation with timestamps. Videos longer than 20 minutes are processed in 10-minute sections using `video_metadata` offsets, with progress shown as "Bölüm 2/3 çevriliyor…".
4. **Errors.** Every failure is shown in plain Turkish with a **Tekrar Dene** (retry) button. Failures covered: no internet, invalid link, video missing or not accessible, invalid or missing key, daily limit reached, and service busy.

[services/pipeline.ts](services/pipeline.ts) wires these steps together. [services/gemini.ts](services/gemini.ts) holds the shared Gemini client and the textile-domain system instruction, which also carries the user's glossary.

### Why these methods (checked October 2026)

| Question | Finding | Decision |
| --- | --- | --- |
| Official YouTube Data API for captions? | `captions.download` only works for the video owner (OAuth). | Not usable. |
| Old `youtube.com/api/timedtext?type=list` | Returns an empty body. | Removed. |
| Caption URLs from the watch web page | Return empty bodies without a proof-of-origin token. | Not usable. |
| Innertube `youtubei/v1/player` with the Android client | Returns title, length and caption tracks; the track URLs download normally. | **Used**, isolated in one file. |
| YouTube's own auto-translation (`tlang=tr`) | Works, but quality on textile terms is weak and it ignores the glossary. | Not used; Gemini translates instead. |
| Gemini YouTube URL input | Documented ([video understanding](https://ai.google.dev/gemini-api/docs/video-understanding)); public videos only; clipping offsets supported. | **Used** as the fallback. |

Tested end to end with real videos:
- Hindi auto-captions, translated via the captions path in about 16 seconds with one request.
- A 22-minute Bengali video whose only caption track was a wrong-language auto-caption. It went through the video path in 3 sections in about 70 seconds.

## Gemini models and free-tier limits

The app uses `gemini-3.5-flash-lite`, then `gemini-3.5-flash`, then `gemini-3.8-flash`. When one model's free **daily** quota runs out, the next model is tried automatically, because each model has its own quota. Per-minute rate limits are waited out, using the delay Google suggests (up to 60 s). Temporary server errors are retried.

Free-tier facts from Google's documentation (subject to change):
- YouTube URL input is limited to **8 hours of YouTube video per day** in total.
- **Private and unlisted videos are not supported** by the video path. Unlisted videos still work through the captions path.
- Per-model request limits are shown in [Google AI Studio](https://aistudio.google.com/) under *Usage / Rate limits*.

**Settings** shows an approximate count of today's requests ("Bugün yaklaşık X işlem kullanıldı"). This is the app's own count, not Google's authoritative number. With 5–10 short videos a day, the captions path usually needs only one or two requests per video.

## Project structure

```
App.tsx                  screen switching + share-intent handling
screens/                 HomeScreen, ResultScreen, HistoryScreen, SettingsScreen
components/              Button, ProgressCard, ErrorCard
hooks/useShareIntent.ts  receives links shared from the YouTube app (APK only)
services/
  pipeline.ts            cache → captions → Gemini video
  transcript.ts          everything that talks to YouTube (replaceable)
  gemini.ts              Gemini client, model fallback, retries, system prompt
  translate.ts           caption translation in batches
  geminiVideo.ts         Gemini YouTube-URL path, long-video sections
  cache.ts               history / cache (AsyncStorage)
  settings.ts            settings, API key (.env or SecureStore)
  usage.ts               approximate daily request counter
utils/                   link parsing, caption grouping, text chunking, language names
__tests__/               unit tests
```

## Setup from zero (Windows)

1. Install **Node.js 22 LTS** from [nodejs.org](https://nodejs.org/) and **Git**.
2. Get the code and install dependencies:

   ```powershell
   git clone <your-repository-url>
   cd LoomLingo
   npm install
   ```

3. Create the key file (see the next section):

   ```powershell
   copy .env.example .env
   ```

## Get a free Gemini API key

1. Open [Google AI Studio → API keys](https://aistudio.google.com/app/apikey) and sign in with a Google account.
2. Click **Create API key** and pick or create a project. No billing account is needed for the free tier.
3. Open `.env` and paste the key:

   ```
   EXPO_PUBLIC_GEMINI_API_KEY=your-key-here
   ```

4. Restart `npx expo start` after changing `.env`. Build a new APK for the change to reach the phone.

How the key is handled:
- `.env` is listed in `.gitignore`, so it is never committed.
- `.env` is **not** listed in [.easignore](.easignore), so EAS Build receives it and bundles the key into the APK. EAS uses `.easignore` instead of `.gitignore` when it uploads the project.
- `EXPO_PUBLIC_` values can be extracted from an APK. Keep the APK private.
- If no key is bundled, the user can enter one in **Ayarlar** (Settings). It is stored encrypted with `expo-secure-store`.

## Try it on the phone with Expo Go (quick UI test)

1. Install **Expo Go** from Google Play and update it to the latest version (it must support SDK 57).
2. Connect the phone and the computer to the same Wi-Fi network.
3. Start the development server:

   ```powershell
   npx expo start --clear
   ```

4. Scan the QR code with Expo Go.

Pasting a link and translating it works in Expo Go. **Receiving a share from the YouTube app does not work in Expo Go**; it needs the APK.

## Build the APK with EAS (free account)

1. Create a free account at [expo.dev](https://expo.dev).
2. Sign in and start the build:

   ```powershell
   npx eas-cli@latest login
   npx eas-cli@latest build --platform android --profile preview
   ```

   - On the first build, answer **Y** to *Generate a new Android Keystore?*. Expo stores the signing key and reuses it for updates.
   - The free tier queues builds; a build usually takes 10–20 minutes.

3. When the build finishes, EAS prints a link. The same build also appears on expo.dev under *Projects → loom-lingo → Builds*.

### Install the APK on the phone

1. Open the build link **on the phone** and tap **Install** or **Download**.
2. Open the downloaded `.apk`.
3. If Android warns about unknown apps, tap **Ayarlar**, turn on **Bu kaynaktan izin ver** for the browser or the Files app, then go back and tap **Yükle**.
4. If Play Protect asks, choose **Yine de yükle**. The app is unknown to Google because it is not on Google Play.
5. Open **Loom Lingo**. To translate a video, either:
   - in YouTube, tap **Paylaş → Loom Lingo** on a video, and translation starts automatically; or
   - paste a link on the home screen and tap **Türkçeye Çevir**.

To update the app later, build again and install the new APK over the old one. History and settings are kept.

## Tests and checks

```powershell
npm run typecheck     # TypeScript, strict
npm test              # Jest unit tests
npx expo-doctor       # Expo dependency/config checks
```

The unit tests cover:
- YouTube link parsing (watch, youtu.be, shorts, live, m.youtube, links inside shared text)
- sentence-aware chunking and paragraph batching
- caption-line grouping and caption track choice
- long-video section planning
- Gemini model fallback, rate-limit waiting, and invalid-key and offline errors

## Maintenance notes

**Captions stopped working** (every video goes through the slower video path):
1. Edit only [services/transcript.ts](services/transcript.ts).
2. First try a newer `clientVersion` in `CLIENT`, using the current YouTube Android app version.
3. If the response format changed, update the field names in `getVideoInfo` / `getCaptionTranscript`.

The app keeps working in the meantime through the Gemini video path.

**Gemini model retired or renamed:**
- Update `MODELS` in [services/gemini.ts](services/gemini.ts).
- To list the models your key can use:

  ```powershell
  curl "https://generativelanguage.googleapis.com/v1beta/models" -H "x-goog-api-key: YOUR_KEY"
  ```

**Glossary:** Settings → *Terim Sözlüğü*. Every entry is added to the system instruction of every Gemini request.

**EAS build fails:**
- Run `npx expo-doctor` and `npx expo install --check` first.
- Make sure `package-lock.json` is saved before building: EAS installs exactly what the lock file says.
- An earlier failure (`Cannot invoke method getAbsolutePath() on null object` in `app/build.gradle`) came from a stale lock file that mixed React Native 0.81 with SDK 57.
