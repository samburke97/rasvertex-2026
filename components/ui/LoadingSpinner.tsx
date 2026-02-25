import styles from "./LoadingSpinner.module.css";

const LoadingSpinner = () => {
  return (
    <div className={styles.loading}>
      <div className={styles.spinner} />
      <p>Loading data...</p>
    </div>
  );
};

export default LoadingSpinner;
