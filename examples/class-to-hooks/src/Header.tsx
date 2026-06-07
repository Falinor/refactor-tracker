import { Component } from 'react';

interface Props {
  title: string;
}

interface State {
  collapsed: boolean;
}

export class Header extends Component<Props, State> {
  state: State = { collapsed: false };

  toggle = () => this.setState({ collapsed: !this.state.collapsed });

  render() {
    return (
      <header>
        <h1 onClick={this.toggle}>{this.props.title}</h1>
      </header>
    );
  }
}
