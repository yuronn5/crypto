import { useState } from "react";
import "./styles.css";

const FilterBlock = ({ setCoins, coins }) => {
  // const coinsContext = useContext(CoinsContext);
  // const { coins } = coinsContext;
  const [value, setValue] = useState('');
  console.log(value);

  return (
    <div className="filter-block">
      <input
        onChange={(e) => setValue(e.target.value)}
        value={value}
        className="input"
        type="text"
        placeholder="bitcoin"
      />
    </div>
  );
};

export default FilterBlock;