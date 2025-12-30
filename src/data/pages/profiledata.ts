import face1 from "/images/faces/face1.png";
// import face2 from "/images/faces/face2.png";
import face9 from "/images/faces/face9.png";

export interface FriendType {
  name: string;
  telepon: string;
  imgSrc: string;
}

export const FriendsList: FriendType[] = [
  {
    name: "JohnDoe",
    telepon: "+62 21 1234 5678",
    imgSrc: face9,
  },
  {
    name: "SarahSmith",
    telepon: "+62 21 4561 5678",
    imgSrc: face1,
  },
  // {
  //   name: "EmmaWilson",
  //   telepon: "+62 21 4311 5678",
  //   imgSrc: face2,
  // },
];
