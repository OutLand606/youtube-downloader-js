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

// Trỏ tới ffmpeg.exe trong cùng thư mục với app
const ffmpegPath = path.join(process.cwd(), "ffmpeg.exe");
ffmpeg.setFfmpegPath(ffmpegPath);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Tạo thư mục output nếu chưa có
const outputDir = path.join(process.cwd(), "output");
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
    const videoFile = path.join(outputDir, "video_temp.mp4");
    const audioFile = path.join(outputDir, "audio_temp.mp3");
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

// Hàm vòng lặp menu
function mainMenu() {
  rl.question(
    "👉 Nhập link YouTube (hoặc gõ 'exit' để thoát): ",
    async (url) => {
      if (url.toLowerCase() === "exit") {
        console.log("👋 Thoát ứng dụng.");
        rl.close();
        return;
      }
      await downloadVideo(url);
      mainMenu(); // quay lại menu
    }
  );
}

// Start
console.log("=== YouTube Downloader (All-in-one) ===\n");
mainMenu();
