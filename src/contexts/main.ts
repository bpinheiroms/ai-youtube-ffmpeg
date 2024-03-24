import { VimeoContext } from "./vimeo";
import { YoutubeContext } from "./youtube";

export const MainContext = () => {
  
  async function init(){
    const source = process.env.CONFIG_SOURCE;

    if(source === "vimeo"){
      const context = VimeoContext();
      await context.init();

      return
    }

    if(source === 'youtube'){
      const context = YoutubeContext();
      await context.init();

      return 
    }
  }

  return {init}
}