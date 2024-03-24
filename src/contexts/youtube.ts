import ffmpeg from "fluent-ffmpeg";
import ytdl from "ytdl-core";
import { delay } from "../utils/misc";
import { createDirectoryIfNotExists, deleteFolderIfExists } from "../libs/folder";
import { storagePath, youtubePath } from "../utils/const";
import { moveFile } from "../libs/file";

export const YoutubeContext = () => {
  
  const downloadMp3 = async (mp3Path: string): Promise<void> => {
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
  
  async function init(){
    try {
      if (process.env.CONFIG_DELETE === "true") deleteFolderIfExists("source");

      createDirectoryIfNotExists(youtubePath.root);
      createDirectoryIfNotExists(youtubePath.textSegment);
      createDirectoryIfNotExists(youtubePath.summarySegment);
      createDirectoryIfNotExists(youtubePath.segments);
      
      await downloadMp3(youtubePath.mp3)
      await moveFile(youtubePath.mp3, `${storagePath.root}youtube/Audio_${new Date().getTime()}.mp3`);

    } catch (error) {
      console.error("Youtube Context Error:", error);
    }
  }

  return {init}
}