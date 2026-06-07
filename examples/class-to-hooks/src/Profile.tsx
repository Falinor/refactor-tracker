import { useState } from 'react';

interface Props {
  name: string;
  bio: string;
}

export function Profile({ name, bio }: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section>
      <h2>{name}</h2>
      {expanded ? <p>{bio}</p> : <button onClick={() => setExpanded(true)}>More</button>}
    </section>
  );
}
