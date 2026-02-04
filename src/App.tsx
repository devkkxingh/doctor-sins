import Experience from './components/Experience';
import { Analytics } from "@vercel/analytics/next"
function App() {
  return (
    <>
      <Experience />
      <Analytics />
    </>
  );
}

export default App;
