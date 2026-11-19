import { readMeasurements } from "../utils/speech";

test.each([
  ["Dikiş sıklığını 2,5 mm yapın.", "Dikiş sıklığını 2,5 milimetre yapın."],
  ["Payı 1cm bırakın", "Payı 1 santimetre bırakın"],
  ["Kaç mm olmalı?", "Kaç milimetre olmalı?"],
  ["3 mm'lik iğne, 10 cm'den sonra", "3 milimetrelik iğne, 10 santimetreden sonra"],
  ["Kumaş 1,5 m uzunlukta, 200 g", "Kumaş 1,5 metre uzunlukta, 200 gram"],
  ["Motor 5000 rpm, 220 V, 0,5 kW, 2 A", "Motor 5000 devir, 220 volt, 0,5 kilovat, 2 amper"],
  ["Gerginliği %30 artırın, sonra 40% yapın", "Gerginliği yüzde 30 artırın, sonra yüzde 40 yapın"],
  ["Ayağı 90° çevirin, 150 °C ütü", "Ayağı 90 derece çevirin, 150 derece ütü"],
  ["No. 14 iğne ve no:90 iplik", "numara 14 iğne ve numara 90 iplik"],
  ["2x5 mm vida", "2 çarpı 5 milimetre vida"],
  ["5\" boru", "5 inç boru"],
])("%s", (input, spoken) => expect(readMeasurements(input)).toBe(spoken));

test("ordinary words are left alone", () => {
  expect(readMeasurements("5 madde var, a harfi ve gram gram ekleyin. Normal ayar, Kamera mm değil")).toBe("5 madde var, a harfi ve gram gram ekleyin. Normal ayar, Kamera milimetre değil");
  expect(readMeasurements("Overlock makinesi 4 iplikli, masura ve 3 iğne")).toBe("Overlock makinesi 4 iplikli, masura ve 3 iğne");
  expect(readMeasurements("Video 2 dakika sürer, sonra 10 adım")).toBe("Video 2 dakika sürer, sonra 10 adım");
});
