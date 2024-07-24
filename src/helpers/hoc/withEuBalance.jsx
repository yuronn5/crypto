/* eslint-disable react/display-name */
export const WithEuBalance = (Component) => {
    return (props) => {
      const { balance } = props;
      const euBalance = balance * 90;
      return <Component {...props} euBalance={euBalance} />;
    };
  };