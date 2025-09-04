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
const path = require("path");
const os = require("os");
const ytdl = require("@distube/ytdl-core");
const ffmpeg = require("fluent-ffmpeg");
const readline = require("readline");
const { spawnSync } = require("child_process");
// const { Innertube } = require("youtubei.js");
const ytsr = require("ytsr");

const isPkg = typeof process.pkg !== "undefined";
const appRoot = isPkg ? path.dirname(process.execPath) : __dirname;

// Tùy OS mà chọn ffmpeg binary
const ffmpegBinary = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

// Ghép path tới ffmpeg
const ffmpegPath = path.join(appRoot, ffmpegBinary);

// Nếu chạy dev mà ffmpeg không có trong project, fallback dùng global ffmpeg
if (!fs.existsSync(ffmpegPath)) {
  console.warn(
    "⚠️ Không tìm thấy ffmpeg trong app, fallback dùng ffmpeg global"
  );
  ffmpeg.setFfmpegPath(ffmpegBinary); // rely on system PATH
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
      console.log("❌ Link không hợp lệ!\n");
      return;
    }

    console.log("⏳ Đang lấy thông tin video...");
    const info = await ytdl.getBasicInfo(url);
    let title = info.videoDetails.title.replace(/[\\/:*?"<>|]/g, ""); // xoá ký tự cấm

    const videoFile = path.join(outputDir, `video_${Date.now()}.mp4`);
    const audioFile = path.join(outputDir, `audio_${Date.now()}.mp3`);
    const outputFile = path.join(outputDir, `${title}.mp4`);

    console.log("⏳ Đang tải video stream...");
    await new Promise((resolve) => {
      ytdl(url, { quality: "highestvideo" })
        .pipe(fs.createWriteStream(videoFile))
        .on("finish", resolve);
    });
    console.log("✅ Video tải xong.");

    console.log("⏳ Đang tải audio stream...");
    await new Promise((resolve) => {
      ytdl(url, { filter: "audioonly", quality: "highestaudio" })
        .pipe(fs.createWriteStream(audioFile))
        .on("finish", resolve);
    });
    console.log("✅ Audio tải xong.");

    console.log("⏳ Đang merge bằng ffmpeg...");
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoFile)
        .input(audioFile)
        .outputOptions("-c copy")
        .save(outputFile)
        .on("end", resolve)
        .on("error", reject);
    });

    console.log(`✅ Xuất file hoàn chỉnh: ${outputFile}`);

    fs.unlinkSync(videoFile);
    fs.unlinkSync(audioFile);
    console.log("🗑️ Đã xoá file tạm.\n");
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
    "👉 Nhập số video muốn tải (limit, tối đa 100): ",
    async (input) => {
      let limitRaw = input;
      let limit = parseInt(input) + 1;
      if (isNaN(limit) || limit <= 0) limit = 50;
      if (limit > 100) limit = 100;

      console.log(`\n⏳ Đang lấy danh sách ${limitRaw} video từ kênh...`);

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
        console.error("❌ Lỗi khi lấy video:", err.message);
        return mainMenu();
      }

      console.log(
        `\n✅ Lấy thành công: ${shorts.length} Shorts (<3 phút), ${videos.length} Videos (≥3 phút)`
      );

      if (shorts.length === 0 && videos.length === 0) {
        console.log("❌ Channel không có nội dung để tải.");
        return mainMenu();
      }

      // --------- Menu tải ---------
      const showDownloadMenu = () => {
        rl.question(
          "👉 Chọn loại cần tải:\n1: Download Shorts\n2: Download Videos\n3: Xem danh sách\n4: Quay lại màn hình chính\n> ",
          async (choice) => {
            if (choice === "1") {
              if (shorts.length === 0) {
                console.log("❌ Không có Shorts để tải.");
              } else {
                for (const item of shorts) {
                  console.log(`\n⬇️ Tải Short: ${item.title}`);
                  await downloadVideo(item.url);
                }
              }
              showDownloadMenu();
            } else if (choice === "2") {
              if (videos.length === 0) {
                console.log("❌ Không có Videos để tải.");
              } else {
                for (const item of videos) {
                  console.log(`\n⬇️ Tải Video: ${item.title}`);
                  await downloadVideo(item.url);
                }
              }
              showDownloadMenu();
            } else if (choice === "3") {
              console.log("\n=== Danh sách Shorts ===");
              if (shorts.length === 0) console.log("❌ Không có Shorts");
              else
                shorts.forEach((v, i) => {
                  console.log(`${i + 1}. ${v.title} \n → Url: ${v.url} \n → Thumb: ${v.thumb} \n → Duration: ${v.duration}`);
                });

              console.log("\n=== Danh sách Videos ===");
              if (videos.length === 0) console.log("❌ Không có Videos");
              else
                videos.forEach((v, i) => {
                  console.log(`${i + 1}. ${v.title} \n → Url: ${v.url} \n → Thumb: ${v.thumb} \n → Duration: ${v.duration}`);
                });

              rl.question("Nhấn Enter để quay lại menu tải...", () => {
                showDownloadMenu();
              });
            } else if (choice === "4") {
              console.log("↩️ Quay lại màn hình chính");
              mainMenu();
            } else {
              console.log("❌ Lựa chọn không hợp lệ");
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
      "3: Thoát\n> ",
    async (choice) => {
      if (choice === "3") {
        console.log("👋 Thoát ứng dụng.");
        rl.close();
        process.exit(0);
      }
      if (choice === "1") {
        rl.question("👉 Nhập channel URL hoặc username: ", async (url) => {
          await handleChannelDownload(url);
        });
      } else if (choice === "2") {
        rl.question("👉 Nhập link video: ", async (url) => {
          await downloadVideo(url);
          mainMenu();
        });
      } else {
        console.log("❌ Lựa chọn không hợp lệ!");
        mainMenu();
      }
    }
  );
}

// Start
console.log("=== YouTube Downloader (All-in-one) ===\n");
mainMenu();
