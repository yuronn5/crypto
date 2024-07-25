import { useEffect, useState } from "react";

export const useFilterCoins = (setCoins, coins) => {
    const [value, setValue] = useState("");
    console.log(value);
  
    useEffect(() => {
      const filteredCoins = coins.filter((coin) => {
        return coin.name.toLowerCase().includes(value.toLowerCase());
      });
  
      setCoins(filteredCoins);
    }, [value]);

    return { setValue, value };
};