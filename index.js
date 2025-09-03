const fs = require("fs");
const path = require("path");
const ytdl = require("@distube/ytdl-core");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static"); // dùng ffmpeg binary từ node_modules
const readline = require("readline");

ffmpeg.setFfmpegPath(ffmpegPath);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Tạo thư mục output nếu chưa có
const outputDir = path.join(__dirname, "output");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

rl.question("👉 Nhập link YouTube: ", async (url) => {
  try {
    if (!ytdl.validateURL(url)) {
      console.log("❌ Link không hợp lệ!");
      rl.close();
      return;
    }

    console.log("⏳ Đang lấy thông tin video...");
    const info = await ytdl.getBasicInfo(url);
    let title = info.videoDetails.title.replace(/[\\/:*?"<>|]/g, ""); // xoá ký tự cấm
    const videoFile = path.join(__dirname, "video_temp.mp4");
    const audioFile = path.join(__dirname, "audio_temp.mp3");
    const outputFile = path.join(outputDir, `${title}.mp4`);

    console.log("⏳ Đang tải video stream...");
    const videoStream = ytdl(url, { quality: "highestvideo" }).pipe(fs.createWriteStream(videoFile));

    videoStream.on("finish", () => {
      console.log("✅ Video tải xong.");
      console.log("⏳ Đang tải audio stream...");

      const audioStream = ytdl(url, { filter: "audioonly", quality: "highestaudio" }).pipe(fs.createWriteStream(audioFile));

      audioStream.on("finish", () => {
        console.log("✅ Audio tải xong.");
        console.log("⏳ Đang merge bằng ffmpeg...");

        ffmpeg()
          .input(videoFile)
          .input(audioFile)
          .outputOptions("-c copy") // không encode lại → nhanh
          .save(outputFile)
          .on("end", () => {
            console.log(`✅ Xuất file hoàn chỉnh: ${outputFile}`);
            // Xoá file tạm
            fs.unlinkSync(videoFile);
            fs.unlinkSync(audioFile);
            console.log("🗑️ Đã xoá file tạm.");
            rl.close();
          })
          .on("error", (err) => {
            console.error("❌ Lỗi khi merge:", err.message);
            rl.close();
          });
      });
    });
  } catch (err) {
    console.error("❌ Lỗi:", err.message);
    rl.close();
  }
});
