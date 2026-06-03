import '@testing-library/jest-dom';

// Mock framer-motion since it uses APIs not supported by JSDOM and causes warning/layout noise
jest.mock('framer-motion', () => {
  const React = require('react');
  
  const dummyComponent = (tagName) => {
    return React.forwardRef(({ children, ...props }, ref) => {
      // Remove framer-motion specific props that should not be in final HTML elements
      const cleanProps = { ...props };
      delete cleanProps.initial;
      delete cleanProps.animate;
      delete cleanProps.exit;
      delete cleanProps.transition;
      return React.createElement(tagName, { ...cleanProps, ref }, children);
    });
  };

  return {
    motion: {
      div: dummyComponent('div'),
      span: dummyComponent('span'),
      button: dummyComponent('button'),
    },
    AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children),
  };
});
