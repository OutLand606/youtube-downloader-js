if (typeof File === "undefined") {
  global.File = class File extends Blob {
    constructor(chunks, filename, options = {}) {
      super(chunks, options);
      this.name = filename;
      this.lastModified = options.lastModified || Date.now();
    }
  };
}

const fs = require("fs");
const os = require("os");
const path = require("path");
const ytsr = require("ytsr");
const readline = require("readline");
const ffmpeg = require("fluent-ffmpeg");
const ytdl = require("@distube/ytdl-core");
// const { Innertube } = require("youtubei.js");

const isPkg = typeof process.pkg !== "undefined";
const appRoot = isPkg ? path.dirname(process.execPath) : __dirname;

// Tùy OS mà chọn ffmpeg binary
const ffmpegBinary = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

// Ghép path tới ffmpeg
const ffmpegPath = path.join(appRoot, ffmpegBinary);

// Nếu chạy dev mà ffmpeg không có trong project, fallback dùng global ffmpeg
if (!fs.existsSync(ffmpegPath)) {
  console.warn(
    "⚠️ Cannot find ffmpeg in app, fallback using ffmpeg global"
  );
  ffmpeg.setFfmpegPath(ffmpegBinary);
} else {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Tạo thư mục output nếu chưa có
const outputDir = path.join(appRoot, "output");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Hàm xử lý tải video
async function downloadVideo(url) {
  try {
    if (!ytdl.validateURL(url)) {
      console.log("❌ Link is not valid!\n");
      return;
    }

    console.log("⏳ Retrieving video information...");
    const info = await ytdl.getBasicInfo(url);
    let title = info.videoDetails.title.replace(/[\\/:*?"<>|]/g, ""); // xoá ký tự cấm

    const videoFile = path.join(outputDir, `video_${Date.now()}.mp4`);
    const audioFile = path.join(outputDir, `audio_${Date.now()}.mp3`);
    const outputFile = path.join(outputDir, `${title}.mp4`);

    // --- Video ---
    console.log("⏳ Loading video stream...");
    await new Promise((resolve, reject) => {
      let starttime;
      ytdl(url, { quality: "highestvideo" })
        .on("progress", (chunkLength, downloaded, total) => {
          const percent = ((downloaded / total) * 100).toFixed(2);
          const downloadedMB = (downloaded / 1024 / 1024).toFixed(2);
          const totalMB = (total / 1024 / 1024).toFixed(2);
          process.stdout.write(`\r📹 Video: ${percent}% [${downloadedMB}MB/${totalMB}MB]`);
        })
        .pipe(fs.createWriteStream(videoFile))
        .on("finish", () => {
          console.log("\n✅ Video has finished downloading.");
          resolve();
        })
        .on("error", reject);
    });

    // --- Audio ---
    console.log("⏳ Loading audio stream...");
    await new Promise((resolve, reject) => {
      ytdl(url, { filter: "audioonly", quality: "highestaudio" })
        .on("progress", (chunkLength, downloaded, total) => {
          const percent = ((downloaded / total) * 100).toFixed(2);
          const downloadedMB = (downloaded / 1024 / 1024).toFixed(2);
          const totalMB = (total / 1024 / 1024).toFixed(2);
          process.stdout.write(`\r🎵 Audio: ${percent}% [${downloadedMB}MB/${totalMB}MB]`);
        })
        .pipe(fs.createWriteStream(audioFile))
        .on("finish", () => {
          console.log("\n✅ Audio download completed.");
          resolve();
        })
        .on("error", reject);
    });

    // --- Merge ---
    console.log("⏳ Merging with ffmpeg...");
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoFile)
        .input(audioFile)
        .outputOptions("-c copy")
        .save(outputFile)
        .on("end", resolve)
        .on("error", reject);
    });

    console.log(`✅ Export complete file: ${outputFile}`);

    fs.unlinkSync(videoFile);
    fs.unlinkSync(audioFile);
    console.log("🗑️ Temporary file deleted.\n");
  } catch (err) {
    console.error("❌ Lỗi:", err.message, "\n");
  }
}

////// Handle search and download ///////
// async function handleChannelDownload(channelUrl) {
//   const yt = await Innertube.create();
//   const resolved = await yt.resolveURL(channelUrl);
//   if (!resolved?.payload?.browseId) {
//     console.error("❌ Không lấy được channelId");
//     return;
//   }

//   const channel = await yt.getChannel(resolved.payload.browseId);

//   // ====== SHORTS ======
//   let shorts = [];
//   try {
//     const shortsPage = await channel.getShorts();
//     const shortsContents = shortsPage.current_tab?.content?.contents || [];

//     shorts = shortsContents
//       .map((item) => {
//         const view = item?.content;
//         const videoId = view?.on_tap_endpoint?.payload?.videoId;
//         if (!videoId) return null;

//         const thumb =
//           view?.thumbnail?.[0]?.url || view?.thumbnails?.[0]?.url || null;

//         return {
//           title: view?.accessibility_text || "No title",
//           videoId,
//           url: `https://www.youtube.com/shorts/${videoId}`,
//           thumb,
//         };
//       })
//       .filter(Boolean);
//   } catch (err) {
//     console.warn("⚠️ Channel không có tab Shorts");
//   }

//   // ====== VIDEOS ======
//   let videos = [];
//   try {
//     const videosPage = await channel.getVideos();
//     const videoContents = videosPage.current_tab?.content?.contents || [];

//     videos = videoContents
//       .map((item) => {
//         const view = item?.content;
//         const videoId = view?.id || view?.on_tap_endpoint?.payload?.videoId;
//         if (!videoId) return null;

//         const thumb =
//           view?.thumbnail?.[0]?.url || view?.thumbnails?.[0]?.url || null;

//         return {
//           title:
//             view?.title?.text ||
//             view?.accessibility_title ||
//             view?.accessibility_text ||
//             "No title",
//           videoId,
//           url: `https://www.youtube.com/watch?v=${videoId}`,
//           thumb,
//         };
//       })
//       .filter(Boolean);
//   } catch (err) {
//     console.warn("⚠️ Channel không có tab Videos");
//   }

//   console.log(
//     `\n✅ Lấy thành công: ${shorts.length} shorts, ${videos.length} videos`
//   );

//   // Nếu không có gì thì thoát
//   if (shorts.length === 0 && videos.length === 0) {
//     console.log("❌ Channel không có nội dung để tải.");
//     return mainMenu();
//   }

//   // Menu phụ
//   rl.question(
//     "👉 Chọn loại cần tải:\n1: Download Shorts\n2: Download Videos\n> ",
//     async (choice) => {
//       if (choice === "1") {
//         if (shorts.length === 0) {
//           console.log("❌ Không có Shorts để tải.");
//         } else {
//           for (const item of shorts) {
//             console.log(`\n⬇️ Tải Short: ${item.title}`);
//             await downloadVideo(item.url);
//           }
//         }
//       } else if (choice === "2") {
//         if (videos.length === 0) {
//           console.log("❌ Không có Videos để tải.");
//         } else {
//           for (const item of videos) {
//             console.log(`\n⬇️ Tải Video: ${item.title}`);
//             await downloadVideo(item.url);
//           }
//         }
//       }
//       mainMenu();
//     }
//   );
// }

// Chuyển duration "mm:ss" hoặc "hh:mm:ss" sang giây

function durationToSeconds(duration) {
  if (!duration) return 0;
  const parts = duration.split(":").map(Number); // ["1","00"] → [1,0]
  if (parts.length === 2) return parts[0] * 60 + parts[1]; // 1*60 + 0 = 60
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

async function handleChannelDownload(channelUrl) {
  rl.question(
    "👉 Enter the number of videos you want to download (limit, maximum 100): ",
    async (input) => {
      let limitRaw = input;
      let limit = parseInt(input) + 1;
      if (isNaN(limit) || limit <= 0) limit = 50;
      if (limit > 100) limit = 100;

      console.log(`\n⏳ Fetching list of ${limitRaw} videos from channel...`);

      let shorts = [];
      let videos = [];

      try {
        const searchResults = await ytsr(channelUrl, { limit });
        searchResults.items
          .filter((item) => item.type === "video")
          .map((v) => {
            const durationSec = durationToSeconds(v.duration);
            const videoObj = {
              title: v.title,
              url: v.url,
              thumb: v.thumbnails?.[0]?.url || null,
              duration: v.duration || "0:00",
            };

            if (durationSec < 180) shorts.push(videoObj);
            else videos.push(videoObj);
          });
      } catch (err) {
        console.error("❌ Error while getting video:", err.message);
        return mainMenu();
      }

      console.log(
        `\n✅ Successfully retrieved: ${shorts.length} Shorts (<3 minutes), ${videos.length} Videos (≥3 minutes)`
      );

      if (shorts.length === 0 && videos.length === 0) {
        console.log("❌ Channel has no content to download.");
        return mainMenu();
      }

      // --------- Menu tải ---------
      const showDownloadMenu = () => {
        rl.question(
          "👉 Select the type to download:\n1: Download Shorts\n2: Download Videos\n3: View list\n4: Return to home screen\n>",
          async (choice) => {
            if (choice === "1") {
              if (shorts.length === 0) {
                console.log("❌ No Shorts to download.");
              } else {
                for (const item of shorts) {
                  console.log(`\n⬇️ Download Short: ${item.title}`);
                  await downloadVideo(item.url);
                }
              }
              showDownloadMenu();
            } else if (choice === "2") {
              if (videos.length === 0) {
                console.log("❌ There are no Videos to download.");
              } else {
                for (const item of videos) {
                  console.log(`\n⬇️ Download Video: ${item.title}`);
                  await downloadVideo(item.url);
                }
              }
              showDownloadMenu();
            } else if (choice === "3") {
              console.log("\n=== List of Shorts ===");
              if (shorts.length === 0) console.log("❌ No Shorts");
              else
                shorts.forEach((v, i) => {
                  console.log(`${i + 1}. ${v.title} \n → Url: ${v.url} \n → Thumb: ${v.thumb} \n → Duration: ${v.duration}`);
                });

              console.log("\n=== List of Videos ===");
              if (videos.length === 0) console.log("❌ No Videos");
              else
                videos.forEach((v, i) => {
                  console.log(`${i + 1}. ${v.title} \n → Url: ${v.url} \n → Thumb: ${v.thumb} \n → Duration: ${v.duration}`);
                });

              rl.question("Press Enter to return to the download menu...", () => {
                showDownloadMenu();
              });
            } else if (choice === "4") {
              console.log("↩️ Back to home screen");
              mainMenu();
            } else {
              console.log("❌ Invalid selection");
              showDownloadMenu();
            }
          }
        );
      };

      showDownloadMenu();
    }
  );
}

////////////////////////////////////////////////////////////////////////////////////////////////

// Hàm vòng lặp menu
function mainMenu() {
  rl.question(
    "=== YouTube Downloader (All-in-one) ===\n" +
      "1: Download by channel (URL or username)\n" +
      "2: Download by direct URL\n" +
      "3: Exit\n> ",
    async (choice) => {
      if (choice === "3") {
        console.log("👋 Exit the application.");
        rl.close();
        process.exit(0);
      }
      if (choice === "1") {
        rl.question("👉 Enter channel URL or username: ", async (url) => {
          await handleChannelDownload(url);
        });
      } else if (choice === "2") {
        rl.question("👉 Enter the video link: ", async (url) => {
          await downloadVideo(url);
          mainMenu();
        });
      } else {
        console.log("❌ Invalid selection!");
        mainMenu();
      }
    }
  );
}

// Start
console.log("=== YouTube Downloader (All-in-one) ===\n");
mainMenu();
