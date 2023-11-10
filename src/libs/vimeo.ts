import * as fs from "fs";
import * as url from "url";
import https from "https";
import { vimeoPath } from "../utils/const";
import { convertToMp3 } from "./audio";

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
  segments: Segments[];
};

type Segments = {
  start: number;
  end: number;
  url: string;
  size: number;
  range: string;
};

function getURLVideo() {
  const linkURL = process.env.LINK;
  const rawMasterUrl = new URL(linkURL as string);
  const masterUrl = rawMasterUrl.toString();
  return masterUrl;
}

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

function prepareToProcess(response: VideoJSONResponse) {
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
  allow: boolean,
  type: string,
  baseUrl: string,
  initData: string,
  segments: Segments[],
  filename: string
): Promise<void> {
  return new Promise<void>(async (resolve, reject) => {
    if (!allow) {
      resolve();
      return;
    }

    console.log(vimeoPath)
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

    const filtered = segments.filter((x) => x.url !== "") || [];

    const segmentsUrl = filtered.map((seg) => {
      if (!seg.url) {
        reject(
          new Error(`Found a segment with an empty URL: ${JSON.stringify(seg)}`)
        );
      }
      return baseUrl + seg.url;
    });

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

export async function downloadVimeo() {
  try {
    const response = await getVideoJSON(getURLVideo());

    const { audio } = prepareToProcess(response);

    // const isVideo = process.env.CONFIG_VIMEO_VIDEO === "true";
    const isAudio = process.env.CONFIG_VIMEO_AUDIO === "true";

    // const videoPromise = processFile(
    //   isVideo,
    //   "video",
    //   video.baseUrl,
    //   video.data!.init_segment,
    //   video.data!.segments,
    //   "Video.m4v"
    // );

    const audioPromise = processFile(
      isAudio,
      "audio",
      audio.baseUrl,
      audio.data!.init_segment,
      audio.data!.segments,
      "Audio.m4a"
    );

    await Promise.all([audioPromise]);

    await convertToMp3(`${vimeoPath.root}/Audio.m4a`, `${vimeoPath.root}/Audio.mp3`);
  } catch (error) {
    console.error(error);
  }
}
