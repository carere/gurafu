import { createSignal } from "solid-js";
import { Button } from "./components/ui/button";

function App() {
  const [count, setCount] = createSignal(0);

  return <Button onClick={() => setCount(count() + 1)}>Clicked {count()} times</Button>;
}

export default App;
