import { getAssetUrl } from "../../utils/assetHelper";
import "./css/Page5.css";
function page5() {
  const members = [
    { name: "김빛나", age: "25세", img: getAssetUrl("김빛나.jpg") },
    { name: "최설화", age: "20세", img: getAssetUrl("최설화.jpg") },
    { name: "한하은", age: "19세", img: getAssetUrl("한하은.jpg") },
    { name: "유강현", age: "18세", img: getAssetUrl("유강현.jpg") },
    { name: "서건희", age: "18세", img: getAssetUrl("서건희".jpg") },
    { name: "최한이", age: "18세", img: getAssetUrl("최한이.jpg") },
    { name: "이동준", age: "16세", img: getAssetUrl("이동준.jpg") },
    { name: "방시온", age: "15세", img: getAssetUrl("방시온.png") },
    { name: "윤태민", age: "16세", img: getAssetUrl("윤태민.jpg") },
    { name: "방진온", age: "17세", img: getAssetUrl("방진온.jpg") }
  ];

  return (
    <div className="section2">
      <h1 className="page5-title">동아리 부원 소개</h1>

      <div className="page5-grid">
        {members.map((member, index) => (
          <div className="page5-card" key={index}>
            <span className="page5-role">{member.role}</span>

            <div className="page5-img">
              <img src={member.img} alt={member.name} />
            </div>

            <p className="page5-gen">{member.gen}</p>
            <p className="page5-name">{member.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default page5;