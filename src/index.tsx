import * as React from 'react';

interface Props {}

interface State {
  hasError: boolean;
}

// const chunkFailedMessage = /Loading chunk [\d]+ failed/;

export class ClearBrowserCache extends React.Component<Props, State> {
  state = { hasError: true };

  static getDerivedStateFromError(error: Error) {
    console.error('getDerivedStateFromError');

    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo) {
    console.error('componentDidCatch');
    // Можно также сохранить информацию об ошибке в соответствующую службу журнала ошибок
    // logErrorToMyService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Error</h1>;
    }

    return this.props.children;
  }
}
