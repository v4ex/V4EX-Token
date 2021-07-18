import Action from './action.js'

// ============================================================================
// Permissions
//
// Situation A: Miner is trying to submit work information to his own Mining Task.


// ============================================================================
// 

export default class SubmitAction extends Action {

  // PROVIDE this.isAllowed
  // OVERRIDDEN
  async isAllowed() {
    return await this.isMinerUser() && await super.isAllowed()
  }

  // CHANGE this.resource | this.webSocketServer.miningTask -> this.webSocketServer.miningTask.#work
  // CHANGE this.responseMessage
  async do() {
    if (!await this.isAllowed()) {
      this.disallow()
      return
    }

    const miningTaskResource = this.resource
    const responseMessage = this.responseMessage
    const payload = this.payload

    if (!miningTaskResource.isInitialized) { // Not yet initialized
      responseMessage.setStatus(409, "Mining Task is not yet initialized, run INITIALIZE first.") // "Conflict"
    } else if (miningTaskResource.isSubmitted) { // Already submitted
      responseMessage.setStatus(409, "Work information exists, RESUBMIT can override.") // "Conflict"
    } else { // Initialized, but not yet submitted
      let submitted = await miningTaskResource.submit(payload.work)                
      if (submitted) {
        responseMessage.setStatus(201, "New work information has been successfully submitted.") // "Created"
      } else {
        responseMessage.setStatus(406, "Submitted work details has failed in verification.") // "Not Acceptable"
      }
    }

    // Attach payload
    if (responseMessage.status < 400) {
      responseMessage.payload.miningTask = miningTaskResource.toModel()
    }
  }

}
