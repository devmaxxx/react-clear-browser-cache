import React from 'react';

const App = () => {
  React.useEffect(() => {
    throw new SyntaxError("Unexpected token '<'");
  }, []);

  return null;
};

export default App;
