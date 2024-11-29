import { clientValidator } from "../utils/validator"
describe("client validator", () => {
    it("validate isFromHost", () => {
        expect(clientValidator.isFromHost(null)).toBe(true)
    })
    it("validate websocket client", () => {
        // expect(clientValidator.isWebsocketClient())
    })
})
