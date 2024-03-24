import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { transcribeBySegment } from "./openai";
import { delay } from "../utils/misc";

export const splitAudioAndTranscribe = async (mp3Path: string, segmentsPath: string, textSegmentPath:string) => {
  return new Promise(async (resolve, reject) => {
    const segmentDuration = 5;

    try {
      const audioPath = fs.realpathSync(mp3Path);

      const audioInfo = (await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(audioPath, (err, info) => {
          if (err) {
            reject(err);
          } else {
            resolve(info.format.duration);
          }
        });
      })) as any;

      const audioDurationInSeconds = parseFloat(audioInfo);
      const audioDurationInMinutes = Math.ceil(audioDurationInSeconds / 60);

      const numSegments = Math.ceil(audioDurationInMinutes / segmentDuration);

      for (let i = 0; i < numSegments; i++) {
        const start = i * segmentDuration;

        const segmentOutputPath = `${segmentsPath}/segment_${i + 1}.mp3`;

        await new Promise<void>((resolve, reject) => {
          ffmpeg(audioPath)
            .setStartTime(start * 60)
            .setDuration(segmentDuration * 60)
            .on("end", async () => {
              console.log(
                `✅ Segmenting ${i + 1}/${numSegments} cut successfully.`
              );
              await transcribeBySegment(segmentOutputPath, i + 1, textSegmentPath);
              resolve();
            })
            .on("error", (err) => {
              console.error(`Error saving segment ${i + 1}:`, err.message);
              reject(err);
            })
            .save(segmentOutputPath);
        });
      }

      console.log("✅ Cutting and saving of successfully completed segments.");
      console.log(`🕐 Waiting 10 seconds for the next action`);
      await delay(1000);
      return resolve(null);
    } catch (error: any) {
      console.error(
        "[splitAudioAndTranscribe] - An error occurred while cutting and saving segments:",
        error.message
      );
      return reject(error);
    }
  });
};

export const convertToMp3 = async (filePath: string, savePath: string) => {
  return new Promise(async (resolve, reject) => {
    try {
      ffmpeg()
        .input(filePath)
        .audioCodec("libmp3lame")
        .audioBitrate("20k")
        .save(savePath)
        .on("end", async () => {
          console.log("✅ Download and conversion to MP3 completed");
          return resolve(null);
        })
        .on("error", (err) => {
          console.error(
            "An error occurred during download and conversion:",
            err
          );
          return reject(err);
        });
    } catch (error) {
      console.error(
        "An error occurred while getting video information:",
        error
      );
      return reject(error);
    }
  });
};

export const joinFiles = async (audioPath: string, videoPath: string, destinationPath: string): Promise<void>  => {
  console.log('⚙️ Joining files ...')
  
  return new Promise((resolve, reject) => {
    ffmpeg()
        .addInput(videoPath)
        .addInput(audioPath)
        .outputOptions('-c:v copy')
        .outputOptions('-c:a aac')
        .outputOptions('-strict experimental')
        .output(destinationPath)
        .on('end', () => {
            console.log('✅ Process was finished, file:', destinationPath);
            resolve();
        })
        .on('error', (err) => {
            console.error('Error:', err.message);
            reject(err);
        })
        .run();
});
}