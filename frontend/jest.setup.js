import '@testing-library/jest-dom';

// Mock framer-motion since it uses APIs not supported by JSDOM and causes warning/layout noise
jest.mock('framer-motion', () => {
  const React = require('react');
  
  const dummyComponent = (tagName) => {
    const Component = React.forwardRef(({ children, ...props }, ref) => {
      // Remove framer-motion specific props that should not be in final HTML elements
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
      return React.createElement(typeof tagName === 'string' ? tagName : 'div', { ...cleanProps, ref }, children);
    });
    Component.displayName = `MotionMock(${typeof tagName === 'string' ? tagName : 'Component'})`;
    return Component;
  };

  const motionTarget = (Comp) => dummyComponent(Comp);

  const motion = new Proxy(motionTarget, {
    get: (_target, prop) => dummyComponent(typeof prop === 'string' ? prop : 'div'),
  });

  return {
    motion,
    AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children),
  };
});
