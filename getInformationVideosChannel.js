const { Innertube } = require("youtubei.js");

(async () => {
  const yt = await Innertube.create();
  const url = "https://www.youtube.com/@fgvn99";

  const resolved = await yt.resolveURL(url);
  if (!resolved?.payload?.browseId) {
    console.error("Không lấy được channelId");
    return;
  }

  // Lấy kênh
  const channel = await yt.getChannel(resolved.payload.browseId);

  // ====== SHORTS ======
  const shortsPage = await channel.getShorts();
  const shortsContents = shortsPage.current_tab?.content?.contents || [];

  const shorts = shortsContents
    .map((item) => {
      const view = item?.content; // ShortsLockupView
      const videoId = view?.on_tap_endpoint?.payload?.videoId;
      if (!videoId) return null;

      const thumb =
        view?.thumbnail?.[0]?.url || view?.thumbnails?.[0]?.url || null;

      return {
        title: view?.accessibility_text || "No title",
        videoId,
        url: `https://www.youtube.com/shorts/${videoId}`,
        thumb,
      };
    })
    .filter(Boolean); // loại bỏ null

  console.log("Danh sách Shorts:", shorts);

  // ====== VIDEOS ======
  const videosPage = await channel.getVideos();
  const videoContents = videosPage.current_tab?.content?.contents || [];

  const videos = videoContents
    .map((item) => {
      const view = item?.content; // VideoLockupView / GridVideo
      const videoId = view?.id || view?.on_tap_endpoint?.payload?.videoId;
      if (!videoId) return null;

      const thumb =
        view?.thumbnail?.[0]?.url || view?.thumbnails?.[0]?.url || null;

      return {
        title:
          view?.title?.text ||
          view?.accessibility_title ||
          view?.accessibility_text ||
          "No title",
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumb,
      };
    })
    .filter(Boolean);

  console.log("Danh sách Videos:", videos);
})();
