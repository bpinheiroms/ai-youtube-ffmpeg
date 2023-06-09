import { transcribe } from "../libs/deepgram";
import { createDirectoryIfNotExists, deleteFolderIfExists } from "../libs/folder";
import { downloadYouTubeVideoAsMP3 } from "../libs/youtube";
import { segmentsPath, summaryFinalSegmentPath, summarySegmentPath, textSegmentPath } from "../utils/const";
import { calculateTime } from "../utils/misc";

export const DeepgramContext = () => {
  let startDate = new Date();

  function startTime() {
    startDate = new Date();
  }

  function closeTime() {
    const end = new Date();
    console.log(`Time spent: ${calculateTime(startDate, end)}`);
  }


  function resetStructure() {
    deleteFolderIfExists("source");
    createDirectoryIfNotExists(textSegmentPath);
    createDirectoryIfNotExists(summarySegmentPath);
    createDirectoryIfNotExists(summaryFinalSegmentPath);
    createDirectoryIfNotExists(segmentsPath);
  }

  async function getTranscribe(){
    await transcribe()
  }

  async function init() {
    startTime();
    resetStructure();
    await downloadYouTubeVideoAsMP3();
    await getTranscribe()
    closeTime();
  }

  return { init };
}