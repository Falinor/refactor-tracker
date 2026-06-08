import React from 'react';

interface Props {
  users: { id: string; name: string }[];
}

export class UserList extends React.Component<Props> {
  render() {
    return (
      <ul>
        {this.props.users.map((u) => (
          <li key={u.id}>{u.name}</li>
        ))}
      </ul>
    );
  }
}
