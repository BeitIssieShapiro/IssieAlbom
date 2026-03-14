import { NativeModules } from 'react-native';

interface FileCopyModuleInterface {
  copyContentUriToTemp(contentUri: string): Promise<string>;
}

const { FileCopyModule } = NativeModules;

export default FileCopyModule as FileCopyModuleInterface;
