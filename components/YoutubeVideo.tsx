import { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet } from "react-native";
import WebView, { WebViewMessageEvent } from "react-native-webview";

export type VideoStatus = { time: number; paused: boolean; ended: boolean; ad: boolean };
export type YoutubeVideoHandle = { play: () => void; pause: () => void; seekTo: (seconds: number) => void; setMuted: (muted: boolean) => void };
type Props = { videoId: string; width: number; height: number; muted: boolean; onStatus: (status: VideoStatus) => void; onError: () => void };

/**
 * YouTube's embed page is opened directly in the WebView (not inside another
 * page's iframe), so the app can reach its <video> element: it reads the time,
 * plays, pauses and seeks, and keeps the original sound muted even after the
 * user starts the video with a tap (the IFrame API's mute is ignored then).
 * The Referer header identifies the app; YouTube refuses embeds without one.
 * Ads are reported so the subtitles wait for the real video.
 */
const REFERER = "https://com.loomlingo.app/";
const script = (muted: boolean) => `(function () {
  if (window.__ll) return true;
  window.__llMuted = ${muted};
  var post = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var video = function () { return document.querySelector("video"); };
  var hush = function () { var v = video(); if (v && window.__llMuted && !v.muted) v.muted = true; };
  window.__ll = function (cmd, arg) {
    var v = video(); if (!v) return;
    if (cmd === "play") v.play().catch(function () {});
    if (cmd === "pause") v.pause();
    if (cmd === "seek") v.currentTime = arg;
    if (cmd === "mute") { window.__llMuted = arg; v.muted = arg; }
  };
  var last = "";
  setInterval(function () {
    var error = document.querySelector(".ytp-error");
    if (error && error.offsetParent !== null) { post({ type: "error" }); return; }
    var v = video(); if (!v) return;
    if (!v.__llHooked) { v.__llHooked = true; v.addEventListener("volumechange", hush); v.addEventListener("play", hush); }
    hush();
    var player = document.querySelector(".html5-video-player");
    var status = { type: "status", time: v.currentTime, paused: v.paused, ended: v.ended, ad: !!(player && player.classList.contains("ad-showing")) };
    var key = [status.paused, status.ended, status.ad].join();
    // While playing, send every tick (the time moves); while paused, only on change.
    if (!v.paused || key !== last) post(status);
    last = key;
  }, 250);
  return true;
})(); true;`;

export const YoutubeVideo = forwardRef<YoutubeVideoHandle, Props>(function YoutubeVideo({ videoId, width, height, muted, onStatus, onError }, ref) {
  const web = useRef<WebView>(null);
  const run = (command: string) => web.current?.injectJavaScript(`window.__ll && window.__ll(${command}); true;`);
  useImperativeHandle(ref, () => ({
    play: () => run(`"play"`), pause: () => run(`"pause"`),
    seekTo: seconds => run(`"seek", ${Math.max(0, seconds)}`), setMuted: on => run(`"mute", ${on}`),
  }), []);
  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type: string } & VideoStatus;
      if (message.type === "error") onError(); else if (message.type === "status") onStatus(message);
    } catch { /* ignore foreign messages */ }
  };
  const uri = `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&iv_load_policy=3&controls=1&fs=0&hl=tr`;
  return <WebView ref={web} source={{ uri, headers: { Referer: REFERER } }} style={[styles.web, { width, height }]} containerStyle={{ width, height, flex: 0 }}
    injectedJavaScript={script(muted)} onMessage={onMessage} javaScriptEnabled mediaPlaybackRequiresUserAction={false} allowsInlineMediaPlayback
    allowsFullscreenVideo={false} setSupportMultipleWindows={false} scrollEnabled={false} bounces={false}
    // Stay on the player: taps on the title or logo would otherwise open youtube.com inside the app.
    onShouldStartLoadWithRequest={request => !request.isTopFrame || request.url.startsWith("https://www.youtube.com/embed/") || request.url.startsWith("about:")}
    onError={onError} />;
});
const styles = StyleSheet.create({ web: { backgroundColor: "#000" } });
