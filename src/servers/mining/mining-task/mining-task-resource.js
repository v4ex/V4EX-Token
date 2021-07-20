
import _ from '../../../utilities/index.js'

import SchemasService from '../../../services/schemas-service.js'

import { MiningTask } from './models/mining-task.js'

import Resource from '../../web-socket/resource.js'


import ViewAction from './actions/view-action.js'
import InitializeAction from './actions/initialize-action.js'
import RevertInitializeAction from './actions/revert-initialize-action.js'
import EditAction from './actions/edit-action.js'
import ClearEditAction from './actions/clear-edit-action.js'
import SubmitAction from './actions/submit-action.js'
import ProceedAction from './actions/proceed-action.js'
import RejectAction from './actions/reject-action.js'
import ResetAction from './actions/reset-action.js'
import ResubmitAction from './actions/resubmit-action.js'




// ============================================================================
// MiningTaskResourceActionsList

// PROTOCOL
export const MiningTaskResourceActionsList = new Map(Object.entries({
  'VIEW': ViewAction,
  'INITIALIZE': InitializeAction,
  'REVERT_INITIALIZE': RevertInitializeAction,
  'EDIT': EditAction,
  'CLEAR_EDIT': ClearEditAction,
  'PROCEED': ProceedAction,
  'REJECT': RejectAction,
  'RESET': ResetAction,
  'RESUBMIT': ResubmitAction,
  'SUBMIT': SubmitAction,
}))

// ============================================================================
// MiningTaskResource
//
// Ownable < Model
// Stored in Miner Durable Object

/**
 * @typedef MiningTask
 * @type {object}
 * 
 * @property {MiningTask} model 
 */
export default class MiningTaskResource extends Resource {
  // Private
  #init
  #storage
  #key
  //
  #id
  #sub
  //
  #timestamps = {
    initializedAt: null, // Initialized timestamp
    editedAt: null,      // Last edited timestamp
    submittedAt: null,   // Submitted timestamp
    committedAt: null,   // Committed timestamp, the actual timestamp of the committed work
    rejectedAt: null,    // Rejected timestamp
    proceededAt: null,   // Proceeded timestamp
    confirmedAt: null,   // Confirmed timestamp
    deniedAt: null,      // Denied timestamp
    admittedAt: null,
    settledAt: null,
    publishedAt: null,
    finishedAt: null
  }

  // Miner stage
  #timestampInitialized
  #timestampEdited
  #timestampSubmitted
  // Broker stage
  #timestampCommitted
  #timestampRejected
  #timestampProceeded
  #timestampConfirmed
  //
  #work

  // TODO Add #timestampRejected, to restrict resubmit operation
  // PROVIDE this.#storage
  // PROVIDE this.#key
  // PROVIDE this.#id
  // PROVIDE this.#sub
  // PROVIDE this.#timestamps
  // PROVIDE this.#work
  // OVERRIDDEN
  constructor(init, storage, key) {
    super()

    this.#init = init

    // Durable Object Storage
    this.#storage = storage
    this.#key = key
  }

  // OVERRIDDEN
  async construct() {
    const {
      sub,
      id,
      timestamps,
      work
    } = await this.#storage.get(this.#key)

    // Miner information
    this.#sub = sub ?? this.#init.sub
    // Generated identity in initialize()
    this.#id = id
    // Timestamps and states
    Object.assign(this.#timestamps, timestamps)
    // Information for Proceeding
    this.#work = work // Work details, e.g. (SPoW) Social Proof of Work
  }

  // OVERRIDDEN
  get actionsList() {
    return MiningTaskResourceActionsList
  }

  // Object public attributes
  // OVERRIDDEN
  get attributes() {
    return {
      sub: this.#sub,
      id: this.#id ?? null,
      timestamps: Object.assign({}, this.#timestamps),
      work: this.#work ? Object.assign({}, this.#work) : null
    }
  }

  // OVERRIDDEN
  toModel() {
    return new MiningTask(this.attributes)
  }

  // ==========================================================================
  // Read / Write

  /**
   * Save data in Durable Object storage.
   * Possible Network Loss Error?
   */
  async save() {
    if (!this.#storage) {
      throw new Error("No storage.")
    }

    await this.#storage.put(this.#key, this.toModel())
  }

  // Reset the cloned object saved in Durable Object.
  async reset() {
    if (!this.#storage) {
      return false
    }

    try {
      await this.#storage.put(this.#key, { sub: this.#sub })

      this.#id = undefined
      this.#work = undefined
      
      for (const key in this.#timestamps) {
        this.#timestamps[key] = undefined
      }

      return true
    } catch (error) {
      return false
    }
  }

  // ==========================================================================
  // States
  // != null loose comparison for undefined and null.

  // PROVIDE this.isInitialized
  get isInitialized() {
    return this.#timestamps.initializedAt != null && this.#id != null
  }

  // PROVIDE this.isEdited
  get isEdited() {
    return this.isInitialized && this.#timestamps.editedAt != null && this.#work != null
  }

  // PROVIDE this.isSubmitted
  get isSubmitted() {
    return this.isEdited && this.#timestamps.submittedAt != null
  }

  // PROVIDE this.isCommitted
  get isCommitted() {
    return this.#timestamps.committedAt != null
  }

  // PROVIDE this.isRejected
  get isRejected() {
    return this.isSubmitted && this.#timestamps.rejectedAt != null && this.#timestamps.rejectedAt > this.#timestamps.submittedAt
  }

  // PROVIDE this.isRejectedBefore
  get isRejectedBefore() {
    return this.#timestamps.rejectedAt != null
  }

  // PROVIDE this.isProceeded
  get isProceeded() {
    return this.isEdited && this.#timestamps.proceededAt != null
  }

  // PROVIDE this.isConfirmed
  get isConfirmed() {
    return this.isProceeded && this.#timestamps.confirmedAt != null
  }

  // PROVIDE this.isDenied
  get isDenied() {
    return this.isConfirmed && this.#timestamps.deniedAt != null && this.#timestamps.deniedAt > this.#timestamps.confirmedAt
  }

  // PROVIDE this.isDeniedBefore
  get isDeniedBefore() {
    return this.#timestamps.deniedAt != null
  }

  // PROVIDE this.isAdmitted
  get isAdmitted() {
    return this.#timestamps.admittedAt != null
  }

  // PROVIDE this.isSettled
  get isSettled() {
    return this.#timestamps.settledAt != null
  }

  // PROVIDE this.isPublished
  get isPublished() {
    return this.#timestamps.publishedAt != null
  }

  // PROVIDE this.isFinished
  get isFinished() {
    return this.#timestamps.finishedAt != null
  }

  // ==========================================================================
  // Miner Stage Operations

  // PROVIDE this.isInMinerStage
  get isInMinerStage() {
    if (!this.isProceeded || this.isFinished) {
      return true
    }
    return false
  }

  // CHANGE this.#id
  // CHANGE this.#timestamps.initializedAt
  /**
   * Initialized Mining Task has random id and timestampInitialized.
   */
  async initialize() {
    if (this.isInitialized) {
      return false
    }

    // Random Id
    this.#id = await _.randomString()
    this.#timestamps.initializedAt = Date.now()

    await this.save().catch(error => {
      this.#id = undefined
      this.#timestamps.initializedAt = undefined
      throw new Error(error)
    })

    return true
  }

  // CHANGE this.#id
  // CHANGE this.#timestamps.initializedAt
  async revertInitialize() {
    if (!this.isInitialized || this.isEdited) {
      return false
    }

    const original = {
      id: this.#id,
      initializedAt: this.#timestamps.initializedAt
    }
    this.#id = undefined
    this.#timestamps.initializedAt = undefined

    await this.save().catch(error => {
      this.#id = original.id
      this.#timestamps.initializedAt = original.initializedAt
      throw new Error(error)
    })

    return true
  }

  // CAREFUL: USER_INPUT
  // CHANGE this.#timestamps.editedAt
  // CHANGE this.#work
  async edit(work) {
    // Prerequisite check
    if (!this.isInitialized || this.isSubmitted) {
      return false
    }

    let valid = await SchemasService.validateSchema('mining-task-work', work)
    if (valid) {
      const original = {
        work: this.#work,
        editedAt: this.#timestamps.editedAt
      }

      this.#work = work
      this.#timestamps.editedAt = Date.now()

      await this.save().catch(error => {
        this.#work = original.work
        this.#timestamps.editedAt = original.editedAt
        throw new Error(error)
      })

      return true
    }
    return false
  }

  // CHANGE this.#timestamps.editedAt
  // CHANGE this.#work
  async clearEdit() {
    // Prerequisite check
    if (!this.isInitialized || !this.isEdited || this.isSubmitted) {
      return false
    }

    const original = {
      work: this.#work,
      editedAt: this.#timestamps.editedAt
    }

    this.#work = undefined
    this.#timestamps.editedAt = undefined

    await this.save().catch(error => {
      this.#work = original.work
      this.#timestamps.editedAt = original.editedAt
      throw new Error(error)
    })

    return true
  }

  // CHANGE this.#timestamps.submittedAt
  async submit() {
    // Prerequisite check
    if (this.isSubmitted || !this.isInitialized || !this.isEdited) {
      return false
    }

    this.#timestamps.submittedAt = Date.now()

    return await this.save()
  }

  // CHANGE this.#timestamps.submittedAt
  async revertSubmit() {
    // Prerequisite check
    if (!this.isSubmitted || this.isProceeded) {
      return false
    }

    this.#timestamps.submittedAt = undefined

    return await this.save()
  }

  // TODO
  async resubmit() {
    // revertSubmit
    // edit
    // submit
  }

  async reboot() {
    await this.reset()
  }

  // ==========================================================================
  // Broker Stage Operations

  // PROVIDE this.isInBrokerStage
  get isInBrokerStage() {
    if (this.isSubmitted && !this.isAdmitted) {
      return true
    }
    return false
  }

  // CHANGE this.#timestamps.rejectedAt
  // CHANGE this.#timestamps.proceededAt
  async reject() {
    if (this.isRejected || this.isConfirmed) {
      return false
    }

    this.#timestamps.rejectedAt = Date.now()
    this.#timestamps.proceededAt = undefined

    return await this.save()
  }

  // CHANGE this.#timestamps.proceededAt
  // CHANGE this.#timestamps.rejectedAt
  async proceed() {
    if (this.isProceeded || this.isConfirmed) {
      return false
    }

    this.#timestamps.proceededAt = Date.now()
    this.#timestamps.rejectedAt = undefined

    return await this.save()
  }

  // CHANGE this.#timestamps.confirmedAt
  async confirm() {
    if (this.isConfirmed || !this.isProceeded || this.isRejected) {
      return false
    }

    this.#timestamps.confirmedAt = Date.now()

    return await this.save()
  }

  // ==========================================================================
  // Minter Stage Operations

  // PROVIDE this.isInMinterStage
  get isInMinterStage() {
    if (this.isConfirmed && !this.isSettled) {
      return true
    }
    return false
  }

  // CHANGE this.#timestamps.admittedAt
  async admit() {
    if (!this.isInMinterStage || this.isAdmitted) {
      return false
    }

    this.#timestamps.admittedAt = Date.now()

    return await this.save()
  }

  // CHANGE this.#timestamps.deniedAt
  async deny() {
    if (!this.isInMinterStage || this.isDenied) {
      return false
    }

    this.#timestamps.deniedAt = Date.now()

    return await this.save()
  }

  // CHANGE this.#timestamps.admittedAt
  // CHANGE this.#timestamps.deniedAt
  async unset() {
    if (!this.isInMinterStage) {
      return false
    }

    this.#timestamps.admittedAt = undefined
    this.#timestamps.deniedAt = undefined

    return await this.save()
  }

  // ==========================================================================
  // Server Middleman Operations

  // PROVIDE this.isInFinalStage
  get isInFinalStage() {
    if (this.isAdmitted) {
      return true
    }
    return false
  }

  async verify() {

  }

  async notify() {

  }

  async settled() {

  }

  async publish() {

  }

  async finish() {

  }

  // CHANGE this.#timestampCommitted
  async setCommit(timestamp) {
    this.#timestampCommitted = timestamp

    return await this.save()
  }

  // ==========================================================================
  // Getter

  // PROVIDE this.sub
  get sub() {
    return this.#sub
  }

  // PROVIDE this.minerId
  get minerId() {
    return this.#sub
  }

}
