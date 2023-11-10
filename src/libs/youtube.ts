import ffmpeg from "fluent-ffmpeg";
import ytdl from "ytdl-core";
import { delay } from "../utils/misc";

export const downloadYouTubeVideoAsMP3 = async (mp3Path: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const videoUrl = process.env.LINK ?? '';

      const videoInfo = await ytdl.getInfo(videoUrl);
      const audioFormat = ytdl.chooseFormat(videoInfo.formats, {
        quality: "highestaudio",
      });

      ffmpeg()
        .input(ytdl(videoUrl, { format: audioFormat }))
        .audioCodec("libmp3lame")
        .audioBitrate("20k")
        .save(mp3Path)
        .on("end", async () => {
          console.log("✅ Download and conversion to MP3 completed");
          console.log(`🕐 Waiting 20 seconds for the next action`);
          await delay(2000);
          return resolve();
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
