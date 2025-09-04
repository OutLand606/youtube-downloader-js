# youtube-downloader-js
## install package
npm install -g pkg

## run build windows
pkg index.js --targets node18-win-x64 --output ./build/youtube-downloader.exe

## run build macos intel x64
pkg index.js --targets node18-macos-x64 --output ./build/youtube-downloader

## run build macos m1/m2 arm
pkg index.js --targets node18-macos-arm64 --output ./build/youtube-downloader

## After run build
copy ffmpeg.exe(windows) or ffmpeg(macos) to folder build