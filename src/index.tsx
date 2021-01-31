import React from 'react';

type Props = {};

type State = {
  hasError: boolean;
};

// const chunkFailedMessage = /Loading chunk [\d]+ failed/;

const errorNames = ['ChunkLoadError', 'SyntaxError'];

export class ClearBrowserCache extends React.Component<Props, State> {
  state = { hasError: false };

  componentDidCatch(error: Error, errorInfo) {
    if (errorNames.includes(error.name)) {
      this.setState({ hasError: true });
    } else {
      throw error;
    }
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}
