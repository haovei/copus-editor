import React, { Suspense, useCallback, useRef, useState } from 'react';
import styles from './style.module.less';
import ReactDOM from 'react-dom/client';

interface FileDownloadComponentProps {
  src: string;
  name: string;
  uploading?: boolean;
  isAsync?: boolean;
  isSelected?: boolean;
}

const FileDownloadComponent: React.FC<FileDownloadComponentProps> = ({ src, name, uploading, isAsync, isSelected }) => {
  const divRef = useRef<null | HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadFile = useCallback((_url: string, _name: string) => {
    const a = document.createElement('a');
    a.href = _url;
    a.target = '_blank';
    a.download = _name;
    // a.style.display = 'none';
    // document.body.appendChild(a);
    a.click();
    // document.body.removeChild(a);
  }, []);

  const handleDownLoad = useCallback(() => {
    if (isDownloading) {
      return;
    }
    if (isAsync) {
      setIsDownloading(true);
      fetch(src)
        .then((response) => response.blob())
        .then((blob) => {
          const url = window.URL.createObjectURL(blob);
          downloadFile(url, name);
          window.URL.revokeObjectURL(url);
        })
        .catch((error) => {
          console.log(error);
        })
        .finally(() => {
          setIsDownloading(false);
        });

      return;
    }
    downloadFile(src, name);
  }, [src, name, isAsync, isDownloading]);

  return (
    <Suspense fallback={null}>
      <div draggable={false} className="uploading-wrap editor-file">
        <div className={`${styles['file-block']} ${isSelected ? `focused` : ''}`} ref={divRef}>
          <div className="file-icon"></div>
          <div className="file-name">{name}</div>
          <div className="file-download" onClick={handleDownLoad}></div>
        </div>
        {uploading && <div className="uploading-text">Uploading...</div>}
      </div>
    </Suspense>
  );
};

export default class FileDownload extends HTMLElement {
  private root: ReactDOM.Root | null = null;

  constructor() {
    super();
    // this.container = document.createElement('div');
    // this.appendChild(this.container);
    this.root = ReactDOM.createRoot(this);
  }

  static observedAttributes = ['src', 'name', 'uploading', 'is-async', 'is-selected'];

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    this.root?.unmount();
  }

  private render() {
    const params = {
      src: this.getAttribute('src') || '',
      name: this.getAttribute('name') || '',
      uploading: this.getAttribute('uploading') === 'true',
      isAsync: this.getAttribute('is-async') === 'true',
      isSelected: this.getAttribute('is-selected') === 'true',
    };

    this.root?.render(<FileDownloadComponent {...params} />);
  }
}
