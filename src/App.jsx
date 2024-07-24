import Header from "./components/Header/Header.jsx";
import Main from "./pages/Main/Main.jsx";
import { useState } from "react";
import { useEffect } from "react";
import { getCoins } from "./api/api.js";
import { useCallback } from "react";

function App() {
  const [balance, setBalance] = useState(10000);
  const [coins, setCoins] = useState([]);
  const [filteredCoins, setFilteredCoins] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const data = await getCoins();
      setCoins(data.coins);
      setFilteredCoins(data.coins);
    };
    fetchData();
  }, []);

  const addBalance = useCallback(() => {
    setBalance((prev) => prev + 1000);
  }, []);

  return (
    <div>
      <Header />
      <Main
        setCoins={setFilteredCoins}
        coins={coins}
        balance={balance}
        setBalance={addBalance}
        filteredCoins={filteredCoins}
      />
    </div>
  );
}

export default App;
