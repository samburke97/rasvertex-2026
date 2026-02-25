import { redirect } from "next/dist/server/api-utils";

const Home = () => {
  return redirect("/dashboard");
};

export default Home;
