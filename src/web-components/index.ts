import FileDownload from './FileDownload';
import ImageViewer from './ImageViewer';

export default function registerWebComponents() {
  const webComponents = [
    { name: 'copus-image-viewer', component: ImageViewer },
    { name: 'copus-file-download', component: FileDownload },
  ];

  webComponents.forEach(({ name, component }) => {
    customElements.define(name, component);
  });
}
