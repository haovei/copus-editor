import React, { memo } from 'react';
import ReactDOM from 'react-dom/client';
import { PhotoView, PhotoProvider } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';

interface ImageViewerComponentProps {
  src: string;
  alt: string;
  width: string;
  height: string;
  className?: string;
  style?: React.CSSProperties;
}

const ImageViewerComponent: React.FC<ImageViewerComponentProps> = memo(
  ({ src, alt, width, height, className, style }) => {
    return (
      <PhotoProvider maskOpacity={0.5}>
        <PhotoView src={src}>
          <img src={src} alt={alt} width={width} height={height} style={style} className={className} />
        </PhotoView>
      </PhotoProvider>
    );
  },
);

ImageViewerComponent.displayName = 'ImageViewerComponent';

export default class ImageViewer extends HTMLElement {
  private root: ReactDOM.Root | null = null;
  private props: ImageViewerComponentProps = {
    src: '',
    alt: '',
    width: 'auto',
    height: 'auto',
  };

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'closed' });
    this.root = ReactDOM.createRoot(shadow);
  }

  static observedAttributes = ['src', 'alt', 'width', 'height', 'class', 'style'];

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'src':
        this.props.src = newValue;
        break;
      case 'alt':
        this.props.alt = newValue;
        break;
      case 'width':
        this.props.width = newValue;
        break;
      case 'height':
        this.props.height = newValue;
        break;
      case 'class':
        this.props.className = newValue;
        break;
      case 'style':
        try {
          this.props.style = JSON.parse(newValue);
        } catch {
          console.warn('Invalid style attribute');
        }
        break;
    }

    this.render();
  }

  private render() {
    this.root?.render(<ImageViewerComponent {...this.props} />);
  }

  disconnectedCallback() {
    this.root?.unmount();
  }
}
