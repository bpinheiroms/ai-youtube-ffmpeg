## Introduction

This poc:

- Downloads any video and audio from youtube and vimeo
- Converts to MP3
- Transcribes
- Summarize
- Creates a PDF with the summary


## Vimeo

To download videos you have to:

1.  Open the browser developer tools on the network tab (`F12` on Windows/Linux, `CMD + Option + I` on Mac OS).
2.  Start the video (or move mouse over the video).
3.  In the "Network" tab, locate the load of the `master.json` file, copy its full URL.
3.1. In some cases Vimeo sends you encrypted video data, that you can workaround by either removing 'query_string_ranges' query parameter and/or adding 'base64_init=1' to it. 
4.  Fill with this full URL in the environment variable `LINK` in the `.env` file.

## Setup

- Install FFMPEG
- Install PNPM
- Create OpenAI account to use their API Key

### Frameworks

- [NodeJs](https://nodejs.org/en) – is an open-source, cross-platform JavaScript runtime environment.

### Solutions

- [ytdl-core](https://github.com/fent/node-ytdl-core) – YouTube downloading module
- [FFMPEG](http://www.ffmpeg.org/) - A complete, cross-platform solution to record, convert and stream audio and video.
- [PDFKit](https://pdfkit.org/) - A JavaScript PDF generation


### How to use
- ```pnpm install```
- ```pnpm build```

- Create .env file and fill in information based on .env.example
- ```pnpm start```

