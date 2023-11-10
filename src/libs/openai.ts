import axios from "axios";
import FormData from "form-data";
import { joinTextFiles, readFile, saveTextToFile } from "./file";

import { delay } from "../utils/misc";

const contentRole = `Você está lendo uma transcrição de um video que aborda ${
  process.env.SUMMARY ?? ""
}. Faça um resumo organizado em bullets, destacando os principais pontos abordados, sem perder as dicas e recomendações dadas pelo autor, não repetir conceitos e exemplos, falar em primeira pessoa.`;

export const transcribeBySegment = async (
  segmentPath: string,
  index: number,
  textSegmentPath: string
): Promise<void> => {
  try {
    const segmentData = readFile(segmentPath);
    const segmentBuffer = Buffer.from(segmentData);

    const formData = new FormData();
    formData.append("file", segmentBuffer, "audio.mp3");
    formData.append("model", "whisper-1");

    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPEN_AI_KEY ?? ""}`,
          ...formData.getHeaders(),
        },
      }
    );

    console.log(`📃 [OpenAI] Transcription by segment completed successfully.`);
    saveTextToFile(response.data.text, `${textSegmentPath}/text_${index}.txt`);

    console.log(`🕐 Waiting 3 seconds for the next segment.`);
    await delay(300);
  } catch (error: any) {
    console.error(
      `[transcribeBySegment] - An error occurred during transcription by segment`,
      error.response ? error.response.data : error
    );
  }
};


export const createSummary = async (path: string, summarySegmentPath: string, textPath: string) => {
  return new Promise(async (resolve, reject) => {
    try {
      const text = await joinTextFiles(path);
      saveTextToFile(text, textPath);

      const size = 4096;
      const outputParts = [];

      for (let i = 0; i < text.length; i += size) {
        outputParts.push(text.slice(i, i + size));
      }

      const messages = [{ role: "user", content: contentRole }];

      if (outputParts) {
        for (const [index, part] of outputParts.entries()) {
          const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
              model: "gpt-3.5-turbo",
              messages: [...messages, { role: "user", content: part }],
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPEN_AI_KEY ?? ""}`,
              },
            }
          );

          saveTextToFile(
            response.data.choices[0].message?.content,
            `${summarySegmentPath}/summary_${index + 1}.txt`
          );
          console.log(
            `✅ [OpenAI] Summary part ${index + 1}/${
              outputParts.length
            } received successfully.`
          );
        }
      } else {
        console.error("No output parts found.");
      }

      return resolve(null);
    } catch (error: any) {
      console.error("An error occurred:", error);
      return reject();
    }
  });
};
