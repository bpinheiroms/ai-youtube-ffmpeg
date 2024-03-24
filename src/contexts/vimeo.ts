import * as fs from "fs";
import * as url from "url";
import https from "https";
import { storagePath, vimeoPath } from "../utils/const";
import { convertToMp3, joinFiles, splitAudioAndTranscribe } from "../libs/media";
import { createDirectoryIfNotExists, deleteFolderIfExists } from "../libs/folder";
import { joinTextFiles, moveFile, saveTextToFile } from "../libs/file";
import { createSummary } from "../libs/openai";
import { createPDFFromTXT } from "../libs/pdf";

type VideoJSONResponse = {
  clip_id: string;
  base_url: string;
  video: MediaType[];
  audio: MediaType[];
};

type MediaType = {
  id: string;
  base_url: string;
  format: string;
  mime_type: string;
  codecs: string;
  bitrate: number;
  avg_bitrate: number;
  duration: number;
  framerate: number;
  max_segment_duration: number;
  init_segment: string;
  index_segment: string;
  index_segment_range?: string
  segments: Segments[];
};

type Segments = {
  start: number;
  end: number;
  url: string;
  size: number;
  range?: string;
};

export const VimeoContext = () => {

  function getVideoJSON(url: string): Promise<VideoJSONResponse> {
    return new Promise<VideoJSONResponse>((resolve, reject) => {
      let data = "";
  
      const req = https.get(url, (res: any) => {
        if (res.statusMessage && res.statusMessage.toLowerCase() !== "gone") {
          res.on("data", (d: any) => (data += d));
          res.on("end", () => {
            try {
              const jsonData = JSON.parse(data) as VideoJSONResponse;
              resolve(jsonData);
            } catch (err) {
              reject(`Error parsing JSON data: ${err}`);
            }
          });
        } else {
          reject(`The master.json file is expired or crushed`);
        }
      });
  
      req.on("error", (e) => {
        reject(e.message);
      });
    });
  }

  function getURLVideo() {
    const linkURL = process.env.LINK;
    const rawMasterUrl = new URL(linkURL as string);
    const masterUrl = rawMasterUrl.toString();
    return masterUrl;
  }

  function getAudioAndVideoData(response: VideoJSONResponse) {
    let audioData: MediaType | undefined = undefined;
    let videoData: MediaType | undefined = undefined;
  
    if (response.video !== null) {
      videoData = [...response.video]
        .sort((a1, a2) => a1.avg_bitrate - a2.avg_bitrate)
        .pop();
    }
  
    if (response.audio !== null) {
      audioData = [...response.audio]
        .sort((a1, a2) => a1.avg_bitrate - a2.avg_bitrate)
        .pop();
    }
  
    const videoBaseUrl = url.resolve(
      url.resolve(getURLVideo(), response.base_url),
      videoData!.base_url
    );
  
    let audioBaseUrl = "";
    if (response.audio !== null) {
      audioBaseUrl = url.resolve(
        url.resolve(getURLVideo(), response.base_url),
        audioData!.base_url
      );
    }
  
    return {
      video: {
        data: videoData,
        baseUrl: videoBaseUrl,
      },
      audio: {
        data: audioData,
        baseUrl: audioBaseUrl,
      },
    };
  }

  async function processFile(
    type: string,
    baseUrl: string,
    initData: string,
    segments: Segments[],
    filename: string,
    index_segment_range?: string
  ): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {

      const file = filename.replace(/[^\w.]/gi, "-");
      const filePath = `${vimeoPath.root}/${file}`;
      const downloadingFlag = `${vimeoPath.root}/.${file}~`;
  
      if (fs.existsSync(downloadingFlag)) {
        console.log(
          "⚠️",
          ` ${file} - ${type} is incomplete, restarting the download`
        );
      } else if (fs.existsSync(filePath)) {
        console.log("⚠️", ` ${file} - ${type} already exists`);
        resolve();
      } else {
        fs.writeFileSync(downloadingFlag, "");
      }
  
      const filtered = segments.filter((x) => x.url !== "");
      const segmentsUrl = filtered.length === 0 ? index_segment_range ? [(segments[0].url = `${baseUrl}range=${index_segment_range}`)] : [] : filtered.map((seg) => baseUrl + seg.url);
  
      const initBuffer = Buffer.from(initData, "base64");
      fs.writeFileSync(filePath, initBuffer);
  
      const output = fs.createWriteStream(filePath, {
        flags: "a",
      });
  
      try {
        await combineSegments(
          type,
          0,
          segmentsUrl,
          output,
          filePath,
          downloadingFlag
        );
        output.end();
        resolve();
      } catch (err) {
        console.log("⚠️", ` ${err}`);
        reject(err);
      }
    });
  }

  async function combineSegments(
    type: string,
    i: number,
    segmentsUrl: string[],
    output: fs.WriteStream,
    filename: string,
    downloadingFlag: string
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (i >= segmentsUrl.length) {
        if (fs.existsSync(downloadingFlag)) {
          fs.unlinkSync(downloadingFlag);
        }
        console.log("🏁", ` ${filename} - ${type} done`);
        resolve();
      } else {
        console.log(
          "📦",
          type === "video" ? "📹" : "🎧",
          `Downloading ${type} segment ${i}/${segmentsUrl.length} of ${filename}`
        );
  
        const req = https
          .get(segmentsUrl[i], (res: any) => {
            if (res.statusCode !== 200) {
              reject(
                new Error(
                  `Downloading segment with URL '${segmentsUrl[i]}' failed with status: ${res.statusCode} ${res.statusMessage}`
                )
              );
            }
  
            res.on("data", (d: any) => output.write(d));
  
            res.on("end", () => {
              resolve(
                combineSegments(
                  type,
                  i + 1,
                  segmentsUrl,
                  output,
                  filename,
                  downloadingFlag
                )
              );
            });
          })
          .on("error", (e) => {
            reject(e);
          });
  
        req.setTimeout(7000, function () {
          console.log("⚠️", "Timeout. Retrying");
          resolve(
            combineSegments(
              type,
              i,
              segmentsUrl,
              output,
              filename,
              downloadingFlag
            )
          );
        });
      }
    });
  }

  async function init() {
    try {

    if (process.env.CONFIG_DELETE === "true") deleteFolderIfExists("source");
    
    createDirectoryIfNotExists(vimeoPath.root);
    createDirectoryIfNotExists(vimeoPath.textSegment);
    createDirectoryIfNotExists(vimeoPath.summarySegment);
    createDirectoryIfNotExists(vimeoPath.segments);
    
    const response = await getVideoJSON(getURLVideo());

    const { audio, video } = getAudioAndVideoData(response);

    const onlyAudio = process.env.CONFIG_VIMEO_ONLY_AUDIO === "true";

    const nameVideo = `Video_${new Date().getTime()}.m4v`
    const nameAudio = `Audio_${new Date().getTime()}.m4a`
    const combinedName = `FinalVideo_${new Date().getTime()}.mp4`

    const videoPath = `${vimeoPath.root}/${nameVideo}`
    const audioPath = `${vimeoPath.root}/${nameAudio}`
    const combinePath = `${vimeoPath.root}/${combinedName}`

    if(!onlyAudio){
      await processFile(
        "video",
        video.baseUrl,
        video.data!.init_segment,
        video.data!.segments,
        nameVideo,
        video.data?.index_segment_range
      )
    }

    await processFile(
      "audio",
      audio.baseUrl,
      audio.data!.init_segment,
      audio.data!.segments,
      nameAudio,
      audio.data?.index_segment_range
    )

    if(process.env.CONFIG_VIMEO_CONVERT_AUDIO_MP3 === "true"){
      await convertToMp3(audioPath, audioPath.replace(".m4a", ".mp3"));
    }

    if(process.env.CONFIG_VIMEO_JOIN_AUDIO_VIDEO === "true"){
      await joinFiles(audioPath, videoPath, combinePath)
    }

    await moveFile(combinePath, `${storagePath.root}vimeo/${combinedName}`);

    if (process.env.CONFIG_TRANSCRIBE === "true"){
      await splitAudioAndTranscribe(vimeoPath.mp3, vimeoPath.segments, vimeoPath.textSegment);
    }
    
    if (process.env.CONFIG_GET_SUMMARY === "true") {
      await createSummary(vimeoPath.textSegment, vimeoPath.summarySegment, vimeoPath.text);
      const txtContent = await joinTextFiles(vimeoPath.summarySegment);
      saveTextToFile(txtContent, vimeoPath.summary);
    }

    if (process.env.CONFIG_CREATE_PDF === "true"){
      await createPDFFromTXT(vimeoPath.summary, vimeoPath.pdf);
    }

  } catch (error) {
    console.error(error);
  }
  }

  return {init}
  
}