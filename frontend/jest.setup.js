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

// Mock framer-motion since it uses APIs not supported by JSDOM and causes warning/layout noise
jest.mock('framer-motion', () => {
  const React = require('react');
  
  const componentCache = new Map();
  const getDummyComponent = (tagName) => {
    const key = typeof tagName === 'string' ? tagName : 'div';
    if (!componentCache.has(key)) {
      const Component = React.forwardRef(({ children, ...props }, ref) => {
        const cleanProps = { ...props };
        delete cleanProps.initial;
        delete cleanProps.animate;
        delete cleanProps.exit;
        delete cleanProps.transition;
        delete cleanProps.whileHover;
        delete cleanProps.whileTap;
        delete cleanProps.whileFocus;
        delete cleanProps.whileInView;
        delete cleanProps.viewport;
        delete cleanProps.layout;
        delete cleanProps.layoutId;
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

