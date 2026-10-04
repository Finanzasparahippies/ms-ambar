import '@testing-library/jest-dom';

// Global mock for window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock next/image to prevent unrecognized DOM attributes warning (e.g., fetchPriority)
jest.mock('next/image', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({
      src,
      alt,
      fill,
      priority,
      fetchPriority,
      quality,
      placeholder,
      blurDataURL,
      unoptimized,
      loader,
      ...props
    }) => {
      const imgProps = {
        src: typeof src === 'object' && src !== null ? (src.default?.src || src.src || '') : src,
        alt: alt || '',
        ...props,
      };
      if (fetchPriority) {
        imgProps.fetchpriority = String(fetchPriority).toLowerCase();
      }
      return React.createElement('img', imgProps);
    },
  };
});

// Mock framer-motion since it uses APIs not supported by JSDOM and causes warning/layout noise
jest.mock('framer-motion', () => {
  const React = require('react');
  
  const MOTION_PROPS = new Set([
    'initial',
    'animate',
    'exit',
    'transition',
    'variants',
    'whileHover',
    'whileTap',
    'whileFocus',
    'whileInView',
    'whileDrag',
    'viewport',
    'layout',
    'layoutId',
    'drag',
    'dragConstraints',
    'dragElastic',
    'dragMomentum',
    'dragPropagation',
    'dragTransition',
    'onDragStart',
    'onDragEnd',
    'onDrag',
    'onAnimationStart',
    'onAnimationComplete',
  ]);

  const componentCache = new Map();
  const getDummyComponent = (tagName) => {
    const key = typeof tagName === 'string' ? tagName : 'div';
    if (!componentCache.has(key)) {
      const Component = React.forwardRef(({ children, ...props }, ref) => {
        const cleanProps = {};
        for (const [propKey, propVal] of Object.entries(props)) {
          if (!MOTION_PROPS.has(propKey)) {
            cleanProps[propKey] = propVal;
          }
        }
        return React.createElement(key, { ...cleanProps, ref }, children);
      });
      Component.displayName = `MotionMock(${key})`;
      componentCache.set(key, Component);
    }
    return componentCache.get(key);
  };

  const motionTarget = (Comp) => getDummyComponent(Comp);

  const motion = new Proxy(motionTarget, {
    get: (_target, prop) => getDummyComponent(typeof prop === 'string' ? prop : 'div'),
  });

  return {
    motion,
    AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children),
  };
});

