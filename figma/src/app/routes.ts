import { createBrowserRouter } from "react-router";
import Roster from "./pages/Roster";
import Songs from "./pages/Songs";
import AdminSongs from "./pages/AdminSongs";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AdminSongs,
  },
  {
    path: "/roster",
    Component: Roster,
  },
  {
    path: "/songs",
    Component: Songs,
  },
]);